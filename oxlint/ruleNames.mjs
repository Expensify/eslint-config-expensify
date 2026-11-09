/**
 * oxlint and ESLint name some rules differently. This maps oxlint's names back to ESLint's rule IDs, so findings show up
 * under the IDs that seatbelt baselines and `eslint-disable` comments use.
 */
import {hostedRuleIDs} from './generatedRules.mjs';
import {splitRuleID} from './hosting.mjs';
import {ESLINT_RULE_RENAMES} from './tables.mjs';

const OXLINT_RULE_RENAMES = Object.fromEntries(Object.entries(ESLINT_RULE_RENAMES).map(([eslintName, oxlintName]) => [oxlintName, eslintName]));

// oxlint reserves its own plugin names, so hosted rules all use `hosted`. This maps each back to its ESLint plugin.
const HOSTED_RULE_ORIGIN = Object.fromEntries(
    hostedRuleIDs.map((ruleID) => {
        const {prefix, name} = splitRuleID(ruleID);
        return [name, prefix];
    }),
);

const OXLINT_DIAGNOSTIC_CODE = /^([\w@/.-]+)\((.+)\)$/;

/**
 * Converts oxlint's name for a finding, like `typescript(no-explicit-any)`, to ESLint's rule ID, like
 * `@typescript-eslint/no-explicit-any`. A code that does not look like `plugin(rule)` comes back unchanged.
 * @param {string} code
 * @param {{hostedRules?: Record<string, string>, pluginPrefixes?: Record<string, string>}} [extra] what the package
 * cannot know: `hostedRules` maps the name of a repo's own `hosted/<name>` rule to its ESLint ID, and `pluginPrefixes`
 * maps a repo's own plugin name to an ESLint prefix (for example `{rc: 'react-hooks'}`)
 * @returns {string}
 */
function toEslintRuleID(code, {hostedRules = {}, pluginPrefixes = {}} = {}) {
    const match = OXLINT_DIAGNOSTIC_CODE.exec(code);
    if (!match) {
        return code;
    }
    const [, plugin, rule] = match;
    if (plugin === 'eslint' || plugin === 'core') {
        return OXLINT_RULE_RENAMES[rule] ?? rule;
    }
    if (plugin === 'typescript') {
        return `@typescript-eslint/${rule}`;
    }
    if (plugin === 'hosted') {
        if (hostedRules[rule]) {
            return hostedRules[rule];
        }
        const origin = HOSTED_RULE_ORIGIN[rule];
        if (origin === undefined) {
            throw new Error(`Hosted rule "${rule}" has no ESLint ID. Pass it in \`hostedRules\`, or run npm run build:oxlint if it is a preset rule.`);
        }
        return `${origin}/${rule}`;
    }
    if (plugin === 'jsx_a11y') {
        return `jsx-a11y/${rule}`;
    }
    return `${pluginPrefixes[plugin] ?? plugin}/${rule}`;
}

// A named export, like every export of the public entry (utils.mjs and index.mjs re-export it).
// eslint-disable-next-line import/prefer-default-export
export {toEslintRuleID};
