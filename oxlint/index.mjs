/**
 * oxlint config for repos that use eslint-config-expensify. `buildOxlintConfig` converts the presets you pick (the same
 * ones you would list in an ESLint config) with @oxlint/migrate and adds your own settings. Rules oxlint cannot run
 * itself run from ESLint's code through the `core` and `hosted` plugins in ./plugins; generated/rules.json lists them, so
 * the plugins load fast. If the list is out of date, `npm run build:oxlint` rebuilds it.
 */
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

import {coreRuleNames, hostedRuleIDs} from './generatedRules.mjs';
import {splitRuleID} from './hosting.mjs';
import {ALWAYS_HOSTED, ESLINT_PREFIX_OF} from './tables.mjs';

// convert.mjs and presets.mjs are loaded by buildOxlintConfig, not here, so importing this file does not load
// @oxlint/migrate, which only repos that build a config need. See ./utils.mjs for the light entry.
export * from './utils.mjs';

const require = createRequire(import.meta.url);

const OWN_PLUGIN_SPECIFIERS = {
    core: fileURLToPath(new URL('./plugins/core.mjs', import.meta.url)),
    hosted: fileURLToPath(new URL('./plugins/hosted.mjs', import.meta.url)),
    rulesdir: fileURLToPath(new URL('./plugins/rulesdir.mjs', import.meta.url)),
};

const OPTION_NAMES = new Set([
    'presets', 'plugins', 'transformRule', 'withNursery', 'nativeRules', 'extraRunningNames', 'reactVersion', 'ignorePatterns', 'env', 'globals', 'settings', 'jsPlugins', 'overrides',
]);

/**
 * @typedef {import('./presets.mjs').PresetEntry} PresetEntry
 * @typedef {import('./convert.mjs').TransformRule} TransformRule
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
        return require(require.resolve('react/package.json', {paths: [process.cwd()]})).version;
    } catch {
        throw new Error('The react preset needs the React version, and `react` cannot be resolved from the working directory. Install react, or pass `reactVersion`.');
    }
}

/**
 * Loads the conversion (and its dependency @oxlint/migrate), which is an optional peer dependency.
 * @returns {Promise<[typeof import('./convert.mjs'), typeof import('./presets.mjs')]>}
 */
async function loadConversion() {
    try {
        return await Promise.all([import('./convert.mjs'), import('./presets.mjs')]);
    } catch (error) {
        if (error?.code === 'ERR_MODULE_NOT_FOUND' && String(error.message).includes('@oxlint/migrate')) {
            const {peerDependencies} = require('../package.json');
            throw new Error(
                `buildOxlintConfig needs @oxlint/migrate, which is not installed. Install @oxlint/migrate ${peerDependencies['@oxlint/migrate']} as a dev dependency.`,
                {cause: error},
            );
        }
        throw error;
    }
}

/**
 * Returns the name a rule runs under when it runs as hosted/ or core/ instead of oxlint's built-in version.
 * @param {string} rule a rule name as written in the repo's overrides
 * @param {string[]} nativeRules ALWAYS_HOSTED rule IDs the repo runs with oxlint's version
 * @returns {string | undefined} undefined when the rule runs under the name given
 */
function getRunningName(rule, nativeRules) {
    const {prefix, name} = splitRuleID(rule);
    const eslintPrefix = prefix in ESLINT_PREFIX_OF ? ESLINT_PREFIX_OF[prefix] : prefix;
    const eslintID = eslintPrefix ? `${eslintPrefix}/${name}` : name;
    if (!eslintPrefix && coreRuleNames.includes(name)) {
        return `core/${name}`;
    }

    // @oxlint/migrate and oxlint write react-hooks rules under `react/`.
    const isHosted = id => ALWAYS_HOSTED.has(id) && !nativeRules.includes(id);
    if (hostedRuleIDs.includes(eslintID) || isHosted(eslintID) || (eslintPrefix === 'react' && isHosted(`react-hooks/${name}`))) {
        return `hosted/${name}`;
    }
    return undefined;
}

/**
 * Throws when the repo sets a rule by its built-in name while it runs as hosted/ or core/ (like
 * `import/prefer-default-export`), which would do nothing or run a second copy. Also throws for a `core/` or `hosted/`
 * rule that no plugin has, since oxlint reports that only when the config loads.
 * @param {string} rule
 * @param {string[]} extraRunningNames
 * @param {string[]} nativeRules
 */
function checkRuleName(rule, extraRunningNames, nativeRules) {
    if (extraRunningNames.some(name => (name.endsWith('/') ? rule.startsWith(name) : rule === name))) {
        return;
    }
    const runningName = getRunningName(rule, nativeRules);
    if (runningName) {
        throw new Error(`The config sets "${rule}", but this rule runs as "${runningName}". Use that name instead.`);
    }
    const {prefix, name} = splitRuleID(rule);
    const isUnknownCore = prefix === 'core' && !coreRuleNames.includes(name);
    const isUnknownHosted = prefix === 'hosted' && !hostedRuleIDs.some(ruleID => splitRuleID(ruleID).name === name);
    if (isUnknownCore || isUnknownHosted) {
        throw new Error(
            `The config sets "${rule}", but ${prefix === 'core' ? 'ESLint core rules' : 'hosted rules'} in generated/rules.json do not include it. `
            + 'Run npm run build:oxlint, or pass it in extraRunningNames if your own plugin provides it.',
        );
    }
}

/**
 * Throws when the converted config needs a `core/` or `hosted/` rule that generated/rules.json does not list, which
 * means the file is out of date.
 * @param {import('oxlint').OxlintConfig} config
 */
function checkRulesJson(config) {
    const hostedNames = new Set(hostedRuleIDs.map(ruleID => splitRuleID(ruleID).name));
    const allRules = [config.rules, ...(config.overrides ?? []).map(override => override.rules)].flatMap(rules => Object.keys(rules ?? {}));
    const missing = allRules.filter(rule => (rule.startsWith('core/') && !coreRuleNames.includes(rule.slice(5))) || (rule.startsWith('hosted/') && !hostedNames.has(rule.slice(7))));
    if (missing.length) {
        throw new Error(`The conversion needs ${[...new Set(missing)].join(', ')}, which generated/rules.json does not list. Run npm run build:oxlint in eslint-config-expensify.`);
    }
}

/**
 * Builds one flat oxlint config (no `extends`) from eslint-config-expensify presets plus the repo's own settings.
 * @param {object} options
 * @param {PresetEntry[]} options.presets the presets to convert, in order, like the ESLint config list: names of this
 * package's exports (`browser`, `react`, `typescript`, `jest`, `scripts`, ...) and `'prettier'` for
 * eslint-config-prettier. `{preset: 'jest', files: [...]}` re-scopes every block of that preset to `files`.
 * @param {{hosted?: string, rulesdir?: string}} [options.plugins] plugin files that replace this package's `hosted` and
 * `rulesdir` plugins. They must keep the plugin name. Use absolute paths or package names.
 * @param {TransformRule} [options.transformRule] called for each preset rule with its ESLint rule ID, before conversion.
 * Return `[newRuleID, entry]` to write the rule under another name, `null` to drop it, `undefined` for the default.
 * React Compiler rules (see `reactCompilerRuleNames`) are kept as @oxlint/migrate writes them, `react/<name>`; map them
 * here to run them another way.
 * @param {string[]} [options.extraRunningNames] rule names (or prefixes ending in `/`) the repo's overrides may use that
 * this package does not know, like `hosted/require-jsdoc` from the repo's own hosted plugin or `rc/`
 * @param {string[]} [options.nativeRules] ESLint rule IDs from `alwaysHostedRuleIDs` (like `react-hooks/exhaustive-deps`) that
 * run with oxlint's own version instead of the hosted copy. Throws for an ID that is not in that list.
 * @param {boolean} [options.withNursery] also convert rules oxlint keeps in its nursery category (false by default)
 * @param {string} [options.reactVersion] the React version for oxlint's react rules; found from the working directory by
 * default, and required (it throws when it cannot be found) if a `react` preset is used
 * @param {RepoConfig['ignorePatterns']} [options.ignorePatterns] added after the presets' patterns
 * @param {RepoConfig['env']} [options.env] merged over the presets' env
 * @param {RepoConfig['globals']} [options.globals] merged over the presets' globals
 * @param {RepoConfig['settings']} [options.settings] merged into the presets' settings, key by key
 * @param {RepoConfig['jsPlugins']} [options.jsPlugins] added after the plugins of the presets
 * @param {RepoConfig['overrides']} [options.overrides] added after the presets' overrides, so they win. A rule that runs as
 * hosted/ or core/ must be written with that name
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
        throw new Error(`nativeRules has ${unknownRules.join(', ')}, which does not run as a hosted rule by default. Choose from: ${[...ALWAYS_HOSTED].join(', ')}.`);
    }
    for (const override of overrides) {
        for (const rule of Object.keys(override.rules ?? {})) {
            checkRuleName(rule, extraRunningNames, nativeRules);
        }
    }

    const [{convertPresets, mergeSettings}, {loadPresetBlocks}] = await loadConversion();
    const {config} = await convertPresets(await loadPresetBlocks(presets), {transformRule, withNursery, nativeRules});
    checkRulesJson(config);

    const allRules = [config.rules, ...config.overrides.map(override => override.rules), ...overrides.map(override => override.rules)];
    const rulesdirIsUsed = allRules.some(rules => Object.keys(rules ?? {}).some(rule => rule.startsWith('rulesdir/')));
    const usesReact = presets.some(entry => (typeof entry === 'string' ? entry : entry.preset) === 'react');
    const version = usesReact ? getReactVersion(reactVersion) : reactVersion;
    return {
        ...config,

        // oxlint reserves its own plugin names, so these use other names.
        jsPlugins: [
            ...(rulesdirIsUsed ? [{name: 'rulesdir', specifier: plugins.rulesdir ?? OWN_PLUGIN_SPECIFIERS.rulesdir}] : []),
            {name: 'core', specifier: OWN_PLUGIN_SPECIFIERS.core},
            {name: 'hosted', specifier: plugins.hosted ?? OWN_PLUGIN_SPECIFIERS.hosted},
            ...(config.jsPlugins ?? []),
            ...jsPlugins,
        ],
        env: {...config.env, ...env},
        globals: {...config.globals, ...globals},
        settings: mergeSettings(config.settings, mergeSettings(version ? {react: {...config.settings?.react, version}} : {}, settings)),
        ignorePatterns: [...(config.ignorePatterns ?? []), ...ignorePatterns],
        overrides: [...config.overrides, ...overrides],
    };
}

export {buildOxlintConfig};
