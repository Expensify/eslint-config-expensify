/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * Loads rules of the ESLint plugins in HOSTED_PLUGIN_PACKAGES so oxlint can run them as JS plugin rules (`hostRule`), plus the
 * small helpers around that, like `definePlugin`, `splitRuleID` and `getInstallCommand`. Nothing loads until a rule is asked for.
 */
import {createRequire} from 'node:module';
import path from 'node:path';

import {withEslintDirectiveIDs} from './eslint-directives.js';
import {HOSTED_PLUGIN_PACKAGES, STUBBED_PARSER_SERVICES} from './tables.js';

const require = createRequire(import.meta.url);

/**
 * @param {string} name an optional peer dependency of this package
 * @returns {string} the command that installs it in a version this package accepts
 */
function getInstallCommand(name) {
    const {peerDependencies} = require('../package.json');
    return `npm install --save-dev "${name}@${peerDependencies[name]}"`;
}

/**
 * Resolves a package one of the presets uses. They are dependencies of this package. `@typescript-eslint/eslint-plugin`
 * comes with `typescript-eslint`, so it is looked up there when the package manager did not hoist it.
 * @param {string} request a package name, like `eslint-plugin-react`
 * @returns {string} the resolved file path
 */
function resolvePackage(request) {
    try {
        return require.resolve(request);
    } catch {
        return require.resolve(request, {paths: [path.dirname(require.resolve('typescript-eslint'))]});
    }
}

/**
 * oxlint runs eslint-plugin-react-hooks rules in its `react` plugin, so `react-hooks/exhaustive-deps` is `react/exhaustive-deps` there.
 * @param {string} ruleID an ESLint rule ID
 * @returns {string} the ID oxlint's own version of the rule has
 */
const toOxlintReactHooksID = ruleID => ruleID.replace(/^react-hooks\//, 'react/');

/**
 * @param {string} ruleID a rule ID as oxlint writes it, with ESLint's plugin prefix
 * @returns {string[]} the ESLint rule IDs it can stand for: `react/<name>` is also `react-hooks/<name>`
 */
const withReactHooksID = ruleID => (ruleID.startsWith('react/') ? [ruleID, ruleID.replace(/^react\//, 'react-hooks/')] : [ruleID]);

/**
 * @param {string} name the name the plugin's rules run under, like `core` for `core/<rule>`
 * @param {Record<string, import('eslint').Rule.RuleModule>} rules
 * @returns {{meta: {name: string, version: string}, rules: Record<string, import('eslint').Rule.RuleModule>}} an oxlint
 * JS plugin
 */
function definePlugin(name, rules) {
    return {meta: {name, version: require('../package.json').version}, rules};
}

/**
 * Splits a rule ID into its plugin prefix and rule name, like `react` and `jsx-no-bind`. A core rule like `curly` has an empty prefix.
 * @param {string} ruleID
 * @returns {{prefix: string, name: string}}
 */
function splitRuleID(ruleID) {
    const slash = ruleID.lastIndexOf('/');
    return slash === -1 ? {prefix: '', name: ruleID} : {prefix: ruleID.slice(0, slash), name: ruleID.slice(slash + 1)};
}

/**
 * Loads the rules of one ESLint plugin from HOSTED_PLUGIN_PACKAGES, so oxlint runs the same rule code as ESLint.
 * @param {string} prefix an ESLint plugin prefix from HOSTED_PLUGIN_PACKAGES, like `react`
 * @returns {Record<string, import('eslint').Rule.RuleModule>}
 */
function getPluginRules(prefix) {
    if (!HOSTED_PLUGIN_PACKAGES[prefix]) {
        throw new Error(`Cannot host rules of the "${prefix}" plugin. Hostable plugins: ${Object.keys(HOSTED_PLUGIN_PACKAGES).join(', ')}.`);
    }
    const plugin = require(resolvePackage(HOSTED_PLUGIN_PACKAGES[prefix]));
    return plugin.rules ?? plugin.default?.rules ?? {};
}

// typescript-eslint's getParserServices(context, true) works without a `program`, but throws without these two node maps.
// It also reads `context.languageOptions.parser` first, so withStubbedParserServices stubs `languageOptions` too.
const STUB_PARSER_SERVICES = {
    esTreeNodeToTSNodeMap: new Map(),
    tsNodeToESTreeNodeMap: new Map(),
};

/**
 * Lets a rule in STUBBED_PARSER_SERVICES run in oxlint. It fails without TypeScript parser services, which oxlint's JS
 * plugins do not have, so it gets STUB_PARSER_SERVICES instead.
 * @param {import('eslint').Rule.RuleModule} rule
 * @returns {import('eslint').Rule.RuleModule}
 */
function withStubbedParserServices(rule) {
    return {
        ...rule,
        create(context) {
            const sourceCode = context.sourceCode ?? context.getSourceCode();

            // A Proxy cannot do this: oxlint defines `parserServices` as a read-only, non-configurable property, and a
            // get trap may not return a different value for it.
            const stubbedSourceCode = Object.create(sourceCode, {
                parserServices: {value: STUB_PARSER_SERVICES},
            });
            const stubbedContext = Object.create(context, {
                sourceCode: {value: stubbedSourceCode},
                getSourceCode: {value: () => stubbedSourceCode},
                languageOptions: {
                    value: context.languageOptions ?? {parser: {meta: {name: 'oxlint-js-plugin'}}},
                },
            });
            return rule.create(stubbedContext);
        },
    };
}

/**
 * Adds the `loc` and `range` ESLint's SourceCode needs to every node of an oxc-parser AST, which has offsets only.
 * @param {Record<string, any>} ast
 * @param {string} code
 */
function addLocations(ast, code) {
    const lineStarts = [0];
    for (let index = code.indexOf('\n'); index !== -1; index = code.indexOf('\n', index + 1)) {
        lineStarts.push(index + 1);
    }
    const toPosition = (offset) => {
        let low = 0;
        let high = lineStarts.length - 1;
        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            if (lineStarts[middle] <= offset) {
                low = middle;
            } else {
                high = middle - 1;
            }
        }
        return {line: low + 1, column: offset - lineStarts[low]};
    };
    const pending = [ast];
    while (pending.length) {
        const node = pending.pop();
        if (Number.isInteger(node.start) && Number.isInteger(node.end)) {
            node.range = [node.start, node.end];
            node.loc = {start: toPosition(node.start), end: toPosition(node.end)};
        }
        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') {
                pending.push(value);
            }
        }
    }
}

let oxcParser;

/**
 * @returns {{parseForESLint: (code: string, options: {filePath: string}) => {ast: Record<string, any>, visitorKeys: Record<string, string[]>}}}
 * a parser for eslint-plugin-import's `languageOptions.parser`, built on oxc-parser, which reads JS, JSX and TS. It returns
 * `visitorKeys` because eslint-plugin-import caches a parsed module only when the parser result has them.
 */
function getOxcParser() {
    if (!oxcParser) {
        let parseSync;
        let visitorKeys;
        try {
            ({parseSync, visitorKeys} = require('oxc-parser'));
        } catch (error) {
            throw new Error(
                `The hosted import/* rules need oxc-parser to read imported modules, and it is not installed. Install it as a dev dependency: ${getInstallCommand('oxc-parser')}`,
                {cause: error},
            );
        }
        oxcParser = {
            parseForESLint(code, {filePath}) {
                const {program, comments} = parseSync(filePath, code);
                const ast = {...program, comments, tokens: []};
                addLocations(ast, code);
                return {ast, visitorKeys};
            },
        };
    }
    return oxcParser;
}

/**
 * Lets an eslint-plugin-import rule read the modules a file imports (named, export, no-cycle, ...). It parses them with
 * `context.languageOptions.parser`, whose `parse` oxlint's JS plugins do not implement, so it gets one built on
 * oxc-parser instead. ESLint's `import/parsers` setting is left out of the config, so this parser reads every module.
 * @param {import('eslint').Rule.RuleModule} rule
 * @returns {import('eslint').Rule.RuleModule}
 */
function withImportParser(rule) {
    return {
        ...rule,
        create(context) {
            const languageOptions = Object.create(context.languageOptions ?? null, {parser: {value: getOxcParser()}});
            return rule.create(Object.create(context, {languageOptions: {value: languageOptions}}));
        },
    };
}

/**
 * Loads one ESLint plugin rule as a hosted rule, so `eslint-disable` comments with its ESLint ID apply to it. A repo that wraps
 * or adds hosted rules builds its own `hosted` plugin from this.
 * @param {string} ruleID the ESLint rule ID, like `react/jsx-no-bind`
 * @param {Record<string, import('eslint').Rule.RuleModule>} [pluginRules] the `rules` of a plugin this package does not list
 * (like eslint-plugin-storybook), which the repo imports itself. By default the rule comes from the plugins this package lists.
 * @returns {import('eslint').Rule.RuleModule}
 */
function hostRule(ruleID, pluginRules) {
    const {prefix, name} = splitRuleID(ruleID);
    const rule = (pluginRules ?? getPluginRules(prefix))[name];
    if (!rule) {
        throw new Error(`The "${prefix}" plugin has no rule named "${name}".`);
    }
    let hosted = STUBBED_PARSER_SERVICES.has(ruleID) ? withStubbedParserServices(rule) : rule;
    if (prefix === 'import') {
        hosted = withImportParser(hosted);
    }
    return withEslintDirectiveIDs(hosted, ruleID);
}

export {
    definePlugin, getInstallCommand, getPluginRules, hostRule, resolvePackage, splitRuleID, toOxlintReactHooksID, withReactHooksID,
};
