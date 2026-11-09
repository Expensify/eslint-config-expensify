/**
 * Loads rules of the ESLint plugins in HOSTED_PLUGIN_PACKAGES so oxlint can run them as JS plugin rules. Nothing is
 * loaded until a rule is asked for, so importing this file stays cheap.
 */
import {createRequire} from 'node:module';
import path from 'node:path';

import {withEslintDirectiveIDs} from './eslintDirectives.mjs';
import {HOSTED_PLUGIN_PACKAGES, STUBBED_PARSER_SERVICES} from './tables.mjs';

const require = createRequire(import.meta.url);

/**
 * Resolves a package one of the presets uses. They are dependencies of this package; `@typescript-eslint/eslint-plugin`
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
 * Splits a rule ID into its plugin prefix and rule name: `react/jsx-no-bind` is `react` and `jsx-no-bind`, and a core
 * rule like `curly` has an empty prefix.
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

// getParserServices(context, true) tolerates a missing `program` but fails on missing node maps, and reads
// context.languageOptions first, so both are stubbed.
const STUB_PARSER_SERVICES = {
    esTreeNodeToTSNodeMap: new Map(),
    tsNodeToESTreeNodeMap: new Map(),
};

/**
 * Lets typescript-eslint's naming-convention run in oxlint. The rule fails without TypeScript parser services, which
 * oxlint's JS plugins do not have, so it gets STUB_PARSER_SERVICES instead.
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
 * Loads one ESLint plugin rule as a hosted rule. `eslint-disable` comments that use its ESLint ID apply to it. A repo
 * that wraps or adds hosted rules builds its own `hosted` plugin from this.
 * @param {string} ruleID the ESLint rule ID, like `react/jsx-no-bind`
 * @returns {import('eslint').Rule.RuleModule}
 */
function hostRule(ruleID) {
    const {prefix, name} = splitRuleID(ruleID);
    const rule = getPluginRules(prefix)[name];
    if (!rule) {
        throw new Error(`The "${prefix}" plugin has no rule named "${name}".`);
    }
    return withEslintDirectiveIDs(STUBBED_PARSER_SERVICES.has(ruleID) ? withStubbedParserServices(rule) : rule, ruleID);
}

export {
    getPluginRules, hostRule, resolvePackage, splitRuleID,
};
