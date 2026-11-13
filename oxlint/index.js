/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * Builds an oxlint config from the eslint-config-expensify presets. Rules oxlint cannot run itself are replayed from ESLint's own
 * code, as `core/<name>` (ESLint core rules) or `hosted/<name>` (plugin rules), see convert.js. generated/rules.json lists them,
 * and `npm run build:oxlint` rebuilds it. A preset block is one entry of an ESLint flat config array.
 */
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

import {REBUILD_RULES_JSON, coreRuleNames, hostedRuleIDsByName} from './generated-rules.js';
import {
    getInstallCommand, splitRuleID, toOxlintReactHooksID, withReactHooksID,
} from './hosting.js';
import {
    REPLAYED_RULE_NAME, isOff, mergeRuleEntries, ruleMapsOf,
} from './rule-entry.js';
import {
    ALWAYS_HOSTED, DROPPED_RULES, ESLINT_PREFIX_OF, NURSERY_RULES_RUN_NATIVE, STAND_INS,
} from './tables.js';

export * from './utils.js';

const require = createRequire(import.meta.url);
const PACKAGE_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));

const OWN_PLUGIN_SPECIFIERS = {
    core: fileURLToPath(new URL('./plugins/core.js', import.meta.url)),
    hosted: fileURLToPath(new URL('./plugins/hosted.js', import.meta.url)),
    rulesdir: fileURLToPath(new URL('./plugins/rulesdir.js', import.meta.url)),
};

const OPTION_NAMES = new Set([
    'presets', 'plugins', 'transformRule', 'withNursery', 'nativeRules', 'extraRunningNames', 'reactVersion', 'ignorePatterns', 'env', 'globals', 'settings', 'jsPlugins', 'overrides',
]);

/**
 * @typedef {import('./presets.js').PresetEntry} PresetEntry
 * @typedef {import('./convert.js').TransformRule} TransformRule
 * @typedef {Pick<import('oxlint').OxlintConfig, 'ignorePatterns' | 'env' | 'globals' | 'settings' | 'jsPlugins' | 'overrides'>} RepoConfig
 */

/**
 * @param {string | undefined} reactVersion
 * @returns {string} the version oxlint's react rules need, since ESLint finds it itself and oxlint does not
 */
function getReactVersion(reactVersion) {
    if (reactVersion) {
        return reactVersion;
    }
    try {
        // Where this package is installed first: that is inside the repo's node_modules, so it finds the repo's own react
        // even when oxlint or an editor runs from another directory. The working directory is the fallback.
        return require(require.resolve('react/package.json', {paths: [PACKAGE_DIRECTORY, process.cwd()]})).version;
    } catch {
        throw new Error(
            'The react preset needs the React version, and `react` cannot be resolved from the working directory or from where eslint-config-expensify is installed. '
            + 'Install react, or pass `reactVersion`.',
        );
    }
}

/**
 * Imports convert.js and presets.js only when a config is built, so importing this file never loads @oxlint/migrate.
 * It is an optional peer dependency, so a missing install gets an install hint.
 * @returns {Promise<[typeof import('./convert.js'), typeof import('./presets.js')]>}
 */
async function loadConversion() {
    try {
        return await Promise.all([import('./convert.js'), import('./presets.js')]);
    } catch (error) {
        if (error?.code === 'ERR_MODULE_NOT_FOUND' && String(error.message).includes('@oxlint/migrate')) {
            throw new Error(
                `buildOxlintConfig needs @oxlint/migrate, which is not installed. Install it as a dev dependency: ${getInstallCommand('@oxlint/migrate')}`,
                {cause: error},
            );
        }
        throw error;
    }
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
 * Returns the name oxlint runs `rule` under, when that differs from the name the repo wrote (like `hosted/<name>`).
 * @param {string} rule a rule name as written in the repo's overrides
 * @param {string[]} nativeRules ALWAYS_HOSTED rule IDs the repo runs with oxlint's version
 * @param {Map<string, string>} replayedRuleIDs ESLint rule ID to the rule that runs it, in the config being built
 * @param {Map<string, string>} renamedRuleIDs ESLint rule ID to the name `transformRule` gave it
 * @param {boolean} withNursery
 * @returns {string | undefined} undefined when the rule runs under the name given
 */
function getRunningName(rule, nativeRules, replayedRuleIDs, renamedRuleIDs, withNursery) {
    const {prefix, name} = splitRuleID(rule);
    const eslintPrefix = prefix in ESLINT_PREFIX_OF ? ESLINT_PREFIX_OF[prefix] : prefix;
    const eslintIDs = getESLintIDs(rule);
    if (eslintIDs.some(id => nativeRules.includes(id))) {
        return undefined;
    }
    const replayedID = eslintIDs.find(id => replayedRuleIDs.has(id));
    if (replayedID) {
        const target = replayedRuleIDs.get(replayedID);
        return target === rule ? undefined : target;
    }
    const renamedID = eslintIDs.find(id => renamedRuleIDs.has(id));
    if (renamedID) {
        const target = renamedRuleIDs.get(renamedID);
        return target === rule ? undefined : target;
    }

    // Rules the presets do not set are looked up in rules.json. rules.json cannot tell which nursery rules oxlint runs
    // itself, so with withNursery the name is accepted as written, and oxlint rejects an unknown one when it loads.
    if (withNursery) {
        return undefined;
    }
    if (!eslintPrefix && coreRuleNames.includes(name)) {
        return `core/${name}`;
    }

    // Hosted rule names are unique (build-oxlint.js checks it), so the lookup by name finds the one ESLint ID.
    return eslintIDs.some(id => hostedRuleIDsByName.get(name) === id || ALWAYS_HOSTED.has(id)) ? `hosted/${name}` : undefined;
}

/**
 * @param {string} rule a `core/<name>` or `hosted/<name>` rule
 * @returns {boolean} whether generated/rules.json lists it
 */
function isListedRunningName(rule) {
    const {prefix, name} = splitRuleID(rule);
    return prefix === 'core' ? coreRuleNames.includes(name) : hostedRuleIDsByName.has(name);
}

/**
 * Throws when an override names a rule in a way that does not match how it runs:
 * - By its built-in name while it runs as `hosted/`, `core/` or under the name `transformRule` gave it. It would do nothing or run a second copy.
 * - By a `hosted/` name while the rule runs natively (`nativeRules`, NURSERY_RULES_RUN_NATIVE).
 * - As a `core/` or `hosted/` rule that no plugin has, because oxlint reports that only when the config loads.
 * - By a rule the conversion drops (DROPPED_RULES) or replaces (STAND_INS), which runs nowhere, so oxlint would refuse to load the config.
 * @param {string} rule
 * @param {{extraRunningNames: string[], nativeRules: string[], replayedRuleIDs: Map<string, string>, renamedRuleIDs: Map<string, string>, withNursery: boolean}} context
 */
function checkRuleName(rule, {
    extraRunningNames, nativeRules, replayedRuleIDs, renamedRuleIDs, withNursery,
}) {
    if (extraRunningNames.some(name => (name.endsWith('/') ? rule.startsWith(name) : rule === name))) {
        return;
    }
    const {prefix, name} = splitRuleID(rule);
    const nativeID = prefix === 'hosted' ? nativeRules.find(ruleID => splitRuleID(ruleID).name === name) : undefined;
    if (nativeID) {
        throw new Error(`The config sets "${rule}", but ${nativeID} is in nativeRules and runs as "${toOxlintReactHooksID(nativeID)}". Use that name instead.`);
    }
    const nurseryNativeID = prefix === 'hosted' ? [...NURSERY_RULES_RUN_NATIVE].find(ruleID => splitRuleID(ruleID).name === name) : undefined;
    if (nurseryNativeID) {
        throw new Error(`The config sets "${rule}", but this rule runs as "${nurseryNativeID}". Use that name instead.`);
    }
    const runningName = getRunningName(rule, nativeRules, replayedRuleIDs, renamedRuleIDs, withNursery);
    if (runningName) {
        throw new Error(`The config sets "${rule}", but this rule runs as "${runningName}". Use that name instead.`);
    }
    const eslintIDs = getESLintIDs(rule).filter(id => !renamedRuleIDs.has(id));
    const droppedID = eslintIDs.find(id => id in DROPPED_RULES);
    if (droppedID) {
        throw new Error(`The config sets "${rule}", but this rule is dropped (${DROPPED_RULES[droppedID]}). oxlint would refuse to load the config. See DROPPED_RULES in oxlint/tables.js.`);
    }
    const standInID = eslintIDs.find(id => id in STAND_INS);
    if (standInID) {
        throw new Error(
            `The config sets "${rule}", but this rule runs as "${STAND_INS[standInID]}". oxlint would refuse to load the config. `
            + 'Use that name instead, see STAND_INS in oxlint/tables.js.',
        );
    }
    if ((prefix === 'core' || prefix === 'hosted') && !isListedRunningName(rule)) {
        const ownPluginHint = prefix === 'hosted' ? 'Pass it in extraRunningNames if your own hosted plugin provides it. ' : '';
        throw new Error(
            `The config sets "${rule}", but ${prefix === 'core' ? 'ESLint core rules' : 'hosted rules'} in generated/rules.json do not include it. ${ownPluginHint}`
            + `If eslint-config-expensify should have it, its generated/rules.json is out of date (run ${REBUILD_RULES_JSON}).`,
        );
    }
}

/**
 * Throws when the converted config needs a `core/` or `hosted/` rule that generated/rules.json does not list, which
 * means the file is out of date.
 * @param {import('oxlint').OxlintConfig} config
 */
function checkRulesJson(config) {
    const missing = ruleMapsOf(config).flatMap(rules => Object.keys(rules)).filter(rule => REPLAYED_RULE_NAME.test(rule) && !isListedRunningName(rule));
    if (missing.length) {
        throw new Error(`The conversion needs ${[...new Set(missing)].join(', ')}, which generated/rules.json does not list. Run ${REBUILD_RULES_JSON}.`);
    }
}

/**
 * Builds one flat oxlint config (no `extends`) from eslint-config-expensify presets plus the repo's own settings.
 * index.d.ts documents each option.
 * @param {object} options
 * @param {PresetEntry[]} options.presets the presets to convert, in order, or `{preset, files}` to run one on `files` only
 * @param {{hosted?: string, rulesdir?: string}} [options.plugins] plugin files that replace this package's `hosted` and `rulesdir` plugins
 * @param {TransformRule} [options.transformRule] renames or drops a preset rule before it is converted
 * @param {string[]} [options.extraRunningNames] rule names (or prefixes ending in `/`) the repo's overrides may use that this package does not know
 * @param {string[]} [options.nativeRules] ESLint rule IDs from `alwaysHostedRuleIDs` that run with oxlint's own version
 * @param {boolean} [options.withNursery] also convert rules oxlint keeps in its nursery category
 * @param {string} [options.reactVersion] the React version for oxlint's react rules, read from the installed `react` by default (`settings.react.version` also works)
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
    extraRunningNames = [],
    reactVersion,
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
    const coreNames = extraRunningNames.filter(name => name.startsWith('core/'));
    if (coreNames.length) {
        throw new Error(`extraRunningNames has ${coreNames.join(', ')}. The \`core\` plugin is fixed, so it cannot provide other rules; put your own rules under another plugin name.`);
    }

    const [{convertPresets, mergeSettings}, {getPresetName, loadPresetBlocks}] = await loadConversion();
    const {config, replayedRuleIDs, renamedRuleIDs} = await convertPresets(await loadPresetBlocks(presets), {transformRule, withNursery, nativeRules});
    checkRulesJson(config);
    for (const override of overrides) {
        for (const rule of Object.keys(override.rules ?? {})) {
            checkRuleName(rule, {
                extraRunningNames, nativeRules, replayedRuleIDs, renamedRuleIDs, withNursery,
            });
        }
    }

    // A plugin whose rules are only ever turned off is not loaded, and those `off` entries are dropped, since oxlint
    // rejects a rule name whose plugin is missing.
    const ruleMaps = [...ruleMapsOf(config), ...ruleMapsOf({overrides})];
    const isUsed = prefix => ruleMaps.some(rules => Object.entries(rules).some(([rule, entry]) => rule.startsWith(prefix) && !isOff(entry)));
    const unusedPrefixes = ['rulesdir/', 'core/', 'hosted/'].filter(prefix => !isUsed(prefix));
    const withoutUnused = rules => rules && Object.fromEntries(Object.entries(rules).filter(([rule]) => !unusedPrefixes.some(prefix => rule.startsWith(prefix))));
    const usesReact = presets.some(entry => getPresetName(entry) === 'react');

    // ESLint's 'detect' means finding the installed react, which oxlint cannot do, so it counts as no version.
    const {version: settingsVersion, ...otherReactSettings} = settings.react ?? {};
    const detects = settingsVersion === 'detect';
    const repoSettings = detects ? {...settings, react: otherReactSettings} : settings;
    const version = usesReact ? getReactVersion(reactVersion ?? (detects ? undefined : settingsVersion)) : reactVersion;
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
        settings: mergeSettings(config.settings, mergeSettings(version ? {react: {...config.settings?.react, version}} : {}, repoSettings)),
        ignorePatterns: [...(config.ignorePatterns ?? []), ...ignorePatterns],
        overrides: [...config.overrides, ...overrides].map(override => (override.rules ? {...override, rules: withoutUnused(override.rules)} : override)),
    };
}

/**
 * Returns a copy of the preset's setting for a rule as `[severity, ...options]`, merged over the preset's blocks as ESLint does
 * (see mergeRuleEntries), so an override can extend it. Only presets.js is loaded, not @oxlint/migrate.
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
