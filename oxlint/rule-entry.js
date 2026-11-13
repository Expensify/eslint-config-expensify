/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * Reads ESLint rule settings, like `'error'` or `['error', {...}]`, and rule names. Its own file because index.js needs it
 * and cannot import convert.js, which loads @oxlint/migrate.
 */

// The rule names that run ESLint's own code through this package's plugins: `core/<name>` and `hosted/<name>`.
const REPLAYED_RULE_NAME = /^(core|hosted)\//;

/**
 * @param {unknown} entry a rule setting, like `'error'` or `['error', {...}]`
 * @returns {unknown[]} the setting as `[severity, ...options]`
 */
const toEntryArray = entry => (Array.isArray(entry) ? entry : [entry]);

/**
 * @param {unknown} entry a rule setting, like `'error'` or `['error', {...}]`
 * @returns {unknown} its severity, like `'error'` or `2`
 */
const getSeverity = entry => (Array.isArray(entry) ? entry[0] : entry);

/**
 * @param {unknown} entry a rule setting
 * @returns {boolean} whether the setting turns the rule off
 */
const isOff = entry => ['off', 0].includes(getSeverity(entry));

/**
 * @param {{rules?: Record<string, unknown>, overrides?: Array<{rules?: Record<string, unknown>}>}} config an oxlint config
 * @returns {Array<Record<string, unknown>>} the rule maps of its root and of each override that has rules
 */
const ruleMapsOf = config => [config.rules, ...(config.overrides ?? []).map(override => override.rules)].filter(Boolean);

/**
 * Merges the settings blocks give one rule, in block order, as ESLint does: options replace earlier options, a bare severity
 * keeps them, and a setting that turns the rule off is skipped. Which files a block is for is ignored.
 * @param {unknown[]} entries the rule's setting in each block, in order (undefined for a block that does not set it)
 * @returns {unknown[] | undefined} the merged `[severity, ...options]`, or undefined when no setting turns the rule on
 */
function mergeRuleEntries(entries) {
    let merged;
    for (const entry of entries) {
        if (entry === undefined || isOff(entry)) {
            continue;
        }
        const [severity, ...options] = toEntryArray(entry);
        merged = [severity, ...(options.length ? options : (merged?.slice(1) ?? []))];
    }
    return merged;
}

export {
    REPLAYED_RULE_NAME, getSeverity, isOff, mergeRuleEntries, ruleMapsOf, toEntryArray,
};
