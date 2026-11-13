/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * Builds an oxlint config from the eslint-config-expensify presets. Rules oxlint cannot run itself are replayed from ESLint's own
 * code, as `core/<name>` (ESLint core rules) or `hosted/<name>` (plugin rules), see convert.js. generated/rules.json lists them,
 * and `npm run build:oxlint` rebuilds it. A preset block is one entry of an ESLint flat config array.
 */
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

import {splitRuleID, toOxlintReactHooksID, withReactHooksID} from './hosting.js';
import {isOff, mergeRuleEntries, ruleMapsOf} from './rule-entry.js';
import {ALWAYS_HOSTED, ESLINT_PREFIX_OF} from './tables.js';

export * from './utils.js';

const require = createRequire(import.meta.url);
const PACKAGE_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));

const OWN_PLUGIN_SPECIFIERS = {
    core: fileURLToPath(new URL('./plugins/core.js', import.meta.url)),
    hosted: fileURLToPath(new URL('./plugins/hosted.js', import.meta.url)),
    rulesdir: fileURLToPath(new URL('./plugins/rulesdir.js', import.meta.url)),
};

const OPTION_NAMES = new Set([
    'presets', 'plugins', 'transformRule', 'withNursery', 'nativeRules', 'ignorePatterns', 'env', 'globals', 'settings', 'jsPlugins', 'overrides',
]);

/**
 * @typedef {import('./presets.js').PresetEntry} PresetEntry
 * @typedef {import('./convert.js').TransformRule} TransformRule
 * @typedef {Pick<import('oxlint').OxlintConfig, 'ignorePatterns' | 'env' | 'globals' | 'settings' | 'jsPlugins' | 'overrides'>} RepoConfig
 */

/**
 * @returns {string} the version of the installed react, which oxlint's react rules need since oxlint cannot find it itself
 */
function getReactVersion() {
    try {
        // Where this package is installed first: that is inside the repo's node_modules, so it finds the repo's own react
        // even when oxlint or an editor runs from another directory. The working directory is the fallback.
        return require(require.resolve('react/package.json', {paths: [PACKAGE_DIRECTORY, process.cwd()]})).version;
    } catch {
        throw new Error(
            'The react preset needs the React version, and `react` cannot be resolved from the working directory or from where eslint-config-expensify is installed. '
            + 'Install react.',
        );
    }
}

/**
 * Imports convert.js and presets.js only when a config is built, so importing this file never loads @oxlint/migrate, an optional peer dependency.
 * @returns {Promise<[typeof import('./convert.js'), typeof import('./presets.js')]>}
 */
function loadConversion() {
    return Promise.all([import('./convert.js'), import('./presets.js')]);
}

/**
 * @param {string} rule a rule name as written in the repo's overrides
 * @returns {string[]} the ESLint rule IDs it can stand for (a `react/` rule can also be a `react-hooks/` one)
 */
function getESLintIDs(rule) {
    const {prefix, name} = splitRuleID(rule);
    const eslintPrefix = prefix in ESLINT_PREFIX_OF ? ESLINT_PREFIX_OF[prefix] : prefix;
    return withReactHooksID(eslintPrefix ? `${eslintPrefix}/${name}` : name);
}

/**
 * Throws when an override names a rule by a name that oxlint loads without complaint but under which the rule does not run, so
 * the override would do nothing:
 * - The ESLint ID of a rule that runs as `core/`, `hosted/` or under the name `transformRule` gave it.
 * - A `hosted/` name of a rule that runs with oxlint's version (`nativeRules`).
 * Any other wrong name, like a `hosted/` rule that does not exist, is left to oxlint, which refuses to load the config.
 * @param {string} rule
 * @param {{nativeRules: string[], replayedRuleIDs: Map<string, string>, renamedRuleIDs: Map<string, string>}} context
 */
function checkRuleName(rule, {nativeRules, replayedRuleIDs, renamedRuleIDs}) {
    const {prefix, name} = splitRuleID(rule);
    const nativeID = prefix === 'hosted' ? nativeRules.find(ruleID => splitRuleID(ruleID).name === name) : undefined;
    if (nativeID) {
        throw new Error(`The config sets "${rule}", but ${nativeID} is in nativeRules and runs as "${toOxlintReactHooksID(nativeID)}". Use that name instead.`);
    }
    const runningName = getESLintIDs(rule).map(id => replayedRuleIDs.get(id) ?? renamedRuleIDs.get(id)).find(Boolean);
    if (runningName && runningName !== rule) {
        throw new Error(`The config sets "${rule}", but this rule runs as "${runningName}". Use that name instead.`);
    }
}

/**
 * Builds one flat oxlint config (no `extends`) from eslint-config-expensify presets plus the repo's own settings.
 * index.d.ts documents each option.
 * @param {object} options
 * @param {PresetEntry[]} options.presets the presets to convert, in order, or `{preset, files}` to run one on `files` only
 * @param {{hosted?: string, rulesdir?: string}} [options.plugins] plugin files that replace this package's `hosted` and `rulesdir` plugins
 * @param {TransformRule} [options.transformRule] renames or drops a preset rule before it is converted
 * @param {string[]} [options.nativeRules] ESLint rule IDs from `alwaysHostedRuleIDs` that run with oxlint's own version
 * @param {boolean} [options.withNursery] also convert rules oxlint keeps in its nursery category
 * @param {RepoConfig['ignorePatterns']} [options.ignorePatterns] added after the presets' patterns
 * @param {RepoConfig['env']} [options.env] merged over the presets' env
 * @param {RepoConfig['globals']} [options.globals] merged over the presets' globals
 * @param {RepoConfig['settings']} [options.settings] merged into the presets' settings, key by key
 * @param {RepoConfig['jsPlugins']} [options.jsPlugins] added after the plugins of the presets
 * @param {RepoConfig['overrides']} [options.overrides] added after the presets' overrides, so they win. A `hosted/` or `core/` rule must be written with that name
 * @returns {Promise<import('oxlint').OxlintConfig>}
 */
async function buildOxlintConfig({
    presets,
    plugins = {},
    transformRule,
    withNursery = false,
    nativeRules = [],
    ignorePatterns = [],
    env = {},
    globals = {},
    settings = {},
    jsPlugins = [],
    overrides = [],
    ...unknown
}) {
    if (Object.keys(unknown).length) {
        throw new Error(`buildOxlintConfig does not know the option ${Object.keys(unknown).join(', ')}. Known options: ${[...OPTION_NAMES].join(', ')}.`);
    }
    if (!Array.isArray(presets) || !presets.length) {
        throw new Error('buildOxlintConfig needs a non-empty `presets` list.');
    }
    const unknownRules = nativeRules.filter(ruleID => !ALWAYS_HOSTED.has(ruleID));
    if (unknownRules.length) {
        throw new Error(`nativeRules has ${unknownRules.join(', ')}, but only rules hosted by default can be listed. Choose from: ${[...ALWAYS_HOSTED].join(', ')}.`);
    }

    const [{convertPresets, mergeSettings}, {getPresetName, loadPresetBlocks}] = await loadConversion();
    const {config, replayedRuleIDs, renamedRuleIDs} = await convertPresets(await loadPresetBlocks(presets), {transformRule, withNursery, nativeRules});
    for (const override of overrides) {
        for (const rule of Object.keys(override.rules ?? {})) {
            checkRuleName(rule, {nativeRules, replayedRuleIDs, renamedRuleIDs});
        }
    }

    // A plugin whose rules are only ever turned off is not loaded, and those `off` entries are dropped, since oxlint
    // rejects a rule name whose plugin is missing.
    const ruleMaps = [...ruleMapsOf(config), ...ruleMapsOf({overrides})];
    const isUsed = prefix => ruleMaps.some(rules => Object.entries(rules).some(([rule, entry]) => rule.startsWith(prefix) && !isOff(entry)));
    const unusedPrefixes = ['rulesdir/', 'core/', 'hosted/'].filter(prefix => !isUsed(prefix));
    const withoutUnused = rules => rules && Object.fromEntries(Object.entries(rules).filter(([rule]) => !unusedPrefixes.some(prefix => rule.startsWith(prefix))));
    const usesReact = presets.some(entry => getPresetName(entry) === 'react');

    const version = usesReact ? getReactVersion() : undefined;
    return {
        ...config,
        rules: withoutUnused(config.rules),

        jsPlugins: [
            ...(isUsed('rulesdir/') ? [{name: 'rulesdir', specifier: plugins.rulesdir ?? OWN_PLUGIN_SPECIFIERS.rulesdir}] : []),
            ...(isUsed('core/') ? [{name: 'core', specifier: OWN_PLUGIN_SPECIFIERS.core}] : []),
            ...(isUsed('hosted/') ? [{name: 'hosted', specifier: plugins.hosted ?? OWN_PLUGIN_SPECIFIERS.hosted}] : []),
            ...(config.jsPlugins ?? []),
            ...jsPlugins,
        ],
        env: {...config.env, ...env},
        globals: {...config.globals, ...globals},
        settings: mergeSettings(config.settings, mergeSettings(version ? {react: {...config.settings?.react, version}} : {}, settings)),
        ignorePatterns: [...(config.ignorePatterns ?? []), ...ignorePatterns],
        overrides: [...config.overrides, ...overrides].map(override => (override.rules ? {...override, rules: withoutUnused(override.rules)} : override)),
    };
}

/**
 * Returns a copy of the preset's setting for a rule as `[severity, ...options]`, merged over the preset's blocks like ESLint, except
 * that settings that turn the rule off are skipped (see mergeRuleEntries), so an override can extend it. Only presets.js is loaded, not @oxlint/migrate.
 * @param {string} preset a preset name, like `typescript`
 * @param {string} ruleID the rule's ESLint ID, like `@typescript-eslint/naming-convention`
 * @returns {Promise<[import('./index.d.ts').RuleSeverity, ...unknown[]]>}
 */
async function getPresetRuleEntry(preset, ruleID) {
    const {loadPresetBlocks} = await import('./presets.js');
    const entry = mergeRuleEntries((await loadPresetBlocks([preset])).map(block => block.rules?.[ruleID]));
    if (!entry) {
        throw new Error(`The "${preset}" preset does not turn on ${ruleID}.`);
    }
    return structuredClone(entry);
}

export {buildOxlintConfig, getPresetRuleEntry};
