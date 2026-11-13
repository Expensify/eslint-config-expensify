/* eslint-disable es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/** Maps oxlint's rule names back to ESLint's rule IDs, which `eslint-disable` comments and a repo's baseline of known findings use. */
import {REBUILD_RULES_JSON, hostedRuleIDsByName} from './generated-rules.js';
import {getPluginRules} from './hosting.js';

const OXLINT_DIAGNOSTIC_CODE = /^([\w@/.-]+)\((.+)\)$/;

let reactHooksRuleNames;

/**
 * Reads the rule names on the first `react(...)` code.
 * @returns {Set<string>} the rules of eslint-plugin-react-hooks, which oxlint runs in its `react` plugin
 */
function getReactHooksRuleNames() {
    reactHooksRuleNames ??= new Set(Object.keys(getPluginRules('react-hooks')));
    return reactHooksRuleNames;
}

/**
 * Converts oxlint's name for a finding, like `typescript(no-explicit-any)`, to ESLint's rule ID, like `@typescript-eslint/no-explicit-any`.
 * The `react(...)` code of an eslint-plugin-react-hooks rule becomes `react-hooks/<rule>`, and a code that is not `plugin(rule)` stays as is.
 * @param {string} code
 * @param {{hostedRules?: Record<string, string>, pluginPrefixes?: Record<string, string>}} [extra] `hostedRules` maps a repo's own
 * `hosted/<name>` rule to its ESLint ID, and `pluginPrefixes` maps its own plugin name to an ESLint prefix (like `{rc: 'react-hooks'}`)
 * @returns {string}
 */
function toEslintRuleID(code, {hostedRules = {}, pluginPrefixes = {}} = {}) {
    const match = OXLINT_DIAGNOSTIC_CODE.exec(code);
    if (!match) {
        return code;
    }
    const [, plugin, rule] = match;
    if (plugin === 'eslint' || plugin === 'core') {
        return rule;
    }
    if (plugin === 'typescript') {
        return `@typescript-eslint/${rule}`;
    }
    if (plugin === 'hosted') {
        if (hostedRules[rule]) {
            return hostedRules[rule];
        }
        const ruleID = hostedRuleIDsByName.get(rule);
        if (!ruleID) {
            throw new Error(`Hosted rule "${rule}" has no ESLint ID. Pass it in \`hostedRules\`, or, if it is a preset rule, run ${REBUILD_RULES_JSON}.`);
        }
        return ruleID;
    }
    if (plugin === 'jsx_a11y') {
        return `jsx-a11y/${rule}`;
    }
    if (plugin === 'react' && getReactHooksRuleNames().has(rule)) {
        return `react-hooks/${rule}`;
    }
    return `${pluginPrefixes[plugin] ?? plugin}/${rule}`;
}

// A named export like the rest of the public API, even though this file has only one.
// eslint-disable-next-line import/prefer-default-export
export {toEslintRuleID};
