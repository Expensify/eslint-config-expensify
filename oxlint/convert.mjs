/**
 * Turns eslint-config-expensify presets (ESLint flat config blocks) into oxlint config with @oxlint/migrate. Rules oxlint
 * cannot run itself are replayed as `core/<rule>` (ESLint core rules) or `hosted/<rule>` (ESLint plugin rules), which
 * run from ESLint's own code through the plugins in ./plugins. If a preset rule cannot run either way, the conversion
 * stops with an error until the rule is listed in tables.mjs, so no rule is lost without a decision.
 */
import migrate from '@oxlint/migrate';
import {builtinRules} from 'eslint/use-at-your-own-risk';

import {getPluginRules, resolvePackage, splitRuleID} from './hosting.mjs';
import {CLASSIC_REACT_HOOKS_RULES, reactCompilerRuleNames} from './reactCompilerRules.mjs';
import {SOURCE_PRESET} from './presets.mjs';
import {
    ALWAYS_HOSTED,
    DEFAULT_SETTINGS,
    DROPPED_RULES,
    DROPPED_SETTINGS_WARNINGS,
    DROPPED_WITHOUT_NURSERY,
    DROP_OPTIONS,
    ESLINT_RULE_RENAMES,
    EXPECTED_WARNINGS,
    HOSTED_PLUGIN_PACKAGES,
    STAND_INS,
    STUBBED_PARSER_SERVICES,
} from './tables.mjs';

const REACT_COMPILER_RULES = new Set(reactCompilerRuleNames);

const TYPESCRIPT_GLOB = /\.(\{[^}]*\b)?[cm]?tsx?\b/;

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
 * @param {unknown} value
 * @returns {boolean} whether the value is a plain object, not an array
 */
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

/**
 * Merges oxlint settings. Nested objects are merged key by key; any other value in `extra` replaces the one in `base`.
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} extra
 * @returns {Record<string, unknown>} a new object; neither argument is changed
 */
function mergeSettings(base, extra) {
    const merged = {...base};
    for (const [key, value] of Object.entries(extra)) {
        merged[key] = isObject(value) && isObject(merged[key]) ? mergeSettings(merged[key], value) : value;
    }
    return merged;
}

/**
 * Collects rules that are written under a new name (rules `@oxlint/migrate` skipped, or renamed by `transformRule`), on
 * the same files as in the preset. Blocks are added in preset order, because order decides the result in oxlint as in
 * ESLint: a later block that sets only a severity keeps the options of an earlier one, and an unscoped block after a
 * scoped one for the same rule is refused, since oxlint would apply the two in a different order.
 * @returns {{
 *   add: (block: Record<string, any>, hits: Array<[string, unknown]>) => void,
 *   result: () => {rules: Record<string, unknown>, overrides: Array<{files: string[], rules: Record<string, unknown>}>},
 * }}
 */
function createRuleCollector() {
    const rules = {};
    const overrides = [];
    const scopedRules = new Set();
    const lastOptions = new Map();
    const toFilesKey = files => JSON.stringify(files ? [...files].sort() : null);
    const withEarlierOptions = (block, target, entry) => {
        const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
        if (options.length) {
            lastOptions.set(target, {files: toFilesKey(block.files), options});
            return entry;
        }
        const earlier = lastOptions.get(target);
        if (!earlier || isOff(severity)) {
            return entry;
        }
        if (earlier.files !== toFilesKey(null) && earlier.files !== toFilesKey(block.files)) {
            throw new Error(`${target} gets options for some files and a bare severity for others; oxlint cannot express ESLint's merge`);
        }
        return [severity, ...earlier.options];
    };
    return {
        add(block, hits) {
            const merged = hits.map(([target, entry]) => [target, withEarlierOptions(block, target, entry)]);
            if (!merged.length) {
                return;
            }
            if (block.ignores) {
                throw new Error('A preset block has both rules and ignores; replaying it is not supported');
            }
            if (!block.files) {
                const clash = merged.filter(([rule]) => scopedRules.has(rule)).map(([rule]) => rule);
                if (clash.length) {
                    throw new Error(`An unscoped preset block after a scoped one sets ${clash.join(', ')}; oxlint would apply them in a different order`);
                }
                Object.assign(rules, Object.fromEntries(merged));
                return;
            }
            for (const [rule] of merged) {
                scopedRules.add(rule);
            }
            overrides.push({files: block.files, rules: Object.fromEntries(merged)});
        },
        result: () => ({rules, overrides}),
    };
}

/**
 * Applies `transformRule` to every preset rule, and checks the React Compiler rules of eslint-plugin-react-hooks.
 * Rules the hook renames come back in `renamed`, collected like the replayed rules, to be added to the converted config.
 * @param {Array<Record<string, any>>} blocks ESLint flat config blocks
 * @param {TransformRule | undefined} transformRule
 * @returns {{blocks: Array<Record<string, any>>, renamed: ReturnType<ReturnType<typeof createRuleCollector>['result']>}}
 */
function applyTransformRule(blocks, transformRule) {
    const collector = createRuleCollector();
    const prepared = blocks.map((block) => {
        if (!block.rules) {
            return block;
        }
        const rules = {};
        const hits = [];
        for (const [ruleID, entry] of Object.entries(block.rules)) {
            const result = transformRule?.(ruleID, entry);
            if (result === null) {
                continue;
            }
            if (Array.isArray(result)) {
                hits.push([result[0], result[1]]);
                continue;
            }
            const {prefix, name} = splitRuleID(ruleID);
            if (prefix === 'react-hooks' && !CLASSIC_REACT_HOOKS_RULES.has(name) && !REACT_COMPILER_RULES.has(name)) {
                throw new Error(
                    `${ruleID} is not a known React Compiler rule of eslint-plugin-react-hooks. Handle it in transformRule, `
                    + 'or update eslint-config-expensify so its list of compiler rules matches the plugin.',
                );
            }
            rules[ruleID] = entry;
        }
        collector.add(block, hits);
        return {...block, rules};
    });
    return {blocks: prepared, renamed: collector.result()};
}

/**
 * Tells whether a warning of @oxlint/migrate is safe to ignore.
 * @param {string} warning
 * @param {Array<Record<string, any>>} blocks the blocks that were converted, to check settings against
 * @returns {boolean}
 */
function isExpectedWarning(warning, blocks) {
    if (EXPECTED_WARNINGS.some(pattern => pattern.test(warning))) {
        return true;
    }
    if (!DROPPED_SETTINGS_WARNINGS.some(pattern => pattern.test(warning))) {
        return false;
    }
    const valuesInPresets = key => blocks.flatMap((block) => {
        const value = key.split('.').reduce((object, part) => (isObject(object) ? object[part] : undefined), block.settings);
        return value === undefined ? [] : [value];
    });
    const keys = [...warning.matchAll(/`([^`]+)`/g)].map(match => match[1]);
    return keys.length > 0 && keys.every(key => key.startsWith('import/') || (key in DEFAULT_SETTINGS && valuesInPresets(key).every(value => value === DEFAULT_SETTINGS[key])));
}

/**
 * Runs @oxlint/migrate twice. With type information it swaps some core rules (like dot-notation) for typescript-eslint
 * versions, which the presets turn off on JS files. The run without type information finds those core rules so they
 * still run on JS files.
 * @param {Array<Record<string, any>>} blocks
 * @param {boolean} withNursery whether @oxlint/migrate also converts rules oxlint still keeps in its nursery category
 * @returns {Promise<{config: Record<string, any>, skipped: Set<string>}>} the converted config, and the ESLint IDs of the
 * preset rules it could not convert
 */
async function runMigrate(blocks, withNursery) {
    const skipped = new Set();
    const run = async (typeAware) => {
        const skippedHere = new Map();
        const reporter = {
            addWarning: (warning) => {
                if (isExpectedWarning(warning, blocks)) {
                    return;
                }
                throw new Error(`@oxlint/migrate: ${warning}\nCheck what it means for the presets' rules, then handle it in oxlint/convert.mjs or tables.mjs.`);
            },
            getWarnings: () => [],
            markSkipped: (rule, category) => skippedHere.set(`${rule}\0${category}`, rule),
            removeSkipped: (rule, category) => skippedHere.delete(`${rule}\0${category}`),
            getSkippedRulesByCategory: () => ({}),
        };
        const config = await migrate(blocks, undefined, {
            reporter, typeAware, jsPlugins: true, withNursery,
        });
        for (const rule of skippedHere.values()) {
            if (typeAware || builtinRules.has(rule)) {
                skipped.add(rule);
            }
        }
        return config;
    };
    const config = await run(true);
    await run(false);
    return {config, skipped};
}

/**
 * Returns the rule that runs a preset rule @oxlint/migrate skipped, or an ALWAYS_HOSTED one: `core/<name>`,
 * `hosted/<name>`, or oxlint's name for a renamed core rule.
 * @param {string} ruleID an ESLint rule ID
 * @param {boolean} withNursery
 * @returns {string | undefined} undefined for rules in DROPPED_RULES or STAND_INS
 */
function getReplayTarget(ruleID, withNursery) {
    if (DROPPED_RULES[ruleID] || STAND_INS[ruleID] || (!withNursery && DROPPED_WITHOUT_NURSERY[ruleID])) {
        return undefined;
    }
    const {prefix, name} = splitRuleID(ruleID);
    if (!prefix && ESLINT_RULE_RENAMES[name]) {
        return ESLINT_RULE_RENAMES[name];
    }
    if (!prefix && builtinRules.has(name)) {
        return `core/${name}`;
    }
    const rule = HOSTED_PLUGIN_PACKAGES[prefix] ? getPluginRules(prefix)[name] : undefined;
    if (rule && (!rule.meta?.docs?.requiresTypeChecking || STUBBED_PARSER_SERVICES.has(ruleID))) {
        return `hosted/${name}`;
    }
    let fix = 'If an installed ESLint plugin has it, add that plugin to HOSTED_PLUGIN_PACKAGES; otherwise add the rule to DROPPED_RULES or STAND_INS';
    if (rule) {
        fix = 'It needs type information, which JS plugins do not get. Add it to DROPPED_RULES or STAND_INS, '
            + 'or to STUBBED_PARSER_SERVICES if it only uses types for options the presets do not set';
    } else if (HOSTED_PLUGIN_PACKAGES[prefix]) {
        fix = `${HOSTED_PLUGIN_PACKAGES[prefix]} has no such rule. Add it to DROPPED_RULES or STAND_INS`;
    }
    throw new Error(`oxlint cannot run ${ruleID} natively or as a JS plugin. ${fix} in oxlint/tables.mjs.`);
}

/**
 * Adds back the preset rules @oxlint/migrate skipped, and the ALWAYS_HOSTED ones, on the same files as in the preset.
 * @param {Array<Record<string, any>>} blocks
 * @param {Map<string, string>} replayedRuleIDs ESLint rule ID to the rule that runs it
 * @returns {ReturnType<ReturnType<typeof createRuleCollector>['result']>}
 */
function replaySkippedRules(blocks, replayedRuleIDs) {
    const collector = createRuleCollector();
    for (const block of blocks) {
        collector.add(block, Object.entries(block.rules ?? {}).flatMap(([ruleID, entry]) => {
            const target = replayedRuleIDs.get(ruleID);
            return target ? [[target, entry]] : [];
        }));
    }
    return collector.result();
}

/**
 * Renames and fixes the rules of one block @oxlint/migrate produced, so oxlint accepts them and they behave as in ESLint.
 * @param {Record<string, unknown>} rules
 * @param {boolean} isTypeScriptBlock whether the block applies to TypeScript files
 * @returns {Record<string, unknown>}
 */
function translateRules(rules = {}, isTypeScriptBlock = false) {
    const out = {};
    for (const [ruleID, entry] of Object.entries(rules)) {
        const {prefix, name} = splitRuleID(ruleID);

        // @oxlint/migrate writes react-hooks rules under the `react/` prefix.
        const hooksRuleID = prefix === 'react' && CLASSIC_REACT_HOOKS_RULES.has(name) ? `react-hooks/${name}` : undefined;

        // ALWAYS_HOSTED rules come back as `hosted/` through replaySkippedRules, and DROPPED_RULES do not run at all.
        if (ALWAYS_HOSTED.has(ruleID) || ALWAYS_HOSTED.has(hooksRuleID) || DROPPED_RULES[ruleID] || DROPPED_RULES[hooksRuleID]) {
            continue;
        }
        if (STAND_INS[ruleID]) {
            out[STAND_INS[ruleID]] = getSeverity(entry);
            continue;
        }
        if (DROP_OPTIONS.has(ruleID)) {
            out[ruleID] = getSeverity(entry);
            continue;
        }
        if (ruleID === 'import/no-cycle' && Array.isArray(entry)) {
            // The preset sets maxDepth to the string "∞" (no limit). oxlint takes only a number and has no limit by default.
            const {maxDepth, ...options} = entry[1] ?? {};
            out[ruleID] = maxDepth === '∞' ? [entry[0], options] : entry;
            continue;
        }
        if (ruleID === 'no-unused-vars' && isTypeScriptBlock && Array.isArray(entry)) {
            // On TS files ESLint uses typescript-eslint's no-unused-vars, which also reports values used only as types.
            // oxlint's rule does that only with this option.
            out[ruleID] = [entry[0], {...entry[1], reportVarsOnlyUsedAsTypes: true}];
            continue;
        }
        out[ruleID] = entry;
    }
    return out;
}

/**
 * Collects the presets' `import/*` settings, which ESLint's import rules read. oxlint has no per-file settings, so all
 * blocks are merged. `import/parsers` is skipped because oxlint parses files itself.
 * @param {Array<Record<string, any>>} blocks
 * @returns {Record<string, unknown>}
 */
function getImportSettings(blocks) {
    let settings = {};
    for (const block of blocks) {
        const entries = Object.entries(block.settings ?? {}).filter(([key]) => key.startsWith('import/') && key !== 'import/parsers');
        settings = mergeSettings(settings, Object.fromEntries(entries));
    }
    return settings;
}

/**
 * The name oxlint gives a JS plugin package: `eslint-plugin-es` is `es`, `@scope/eslint-plugin-x` is `@scope/x`.
 * @param {string} jsPlugin
 * @returns {string}
 */
function getJsPluginName(jsPlugin) {
    const scoped = /^(@[^/]+)\/eslint-plugin(?:-(.+))?$/.exec(jsPlugin);
    if (scoped) {
        return scoped[2] ? `${scoped[1]}/${scoped[2]}` : scoped[1];
    }
    return jsPlugin.replace(/^eslint-plugin-/, '');
}

/**
 * @typedef {(ruleID: string, entry: unknown) => [string, unknown] | null | undefined} TransformRule
 * Called for each preset rule with its ESLint rule ID before it is converted. Return `[newRuleID, entry]` to write the
 * rule under another name (the name is used as written), `null` to drop it, or `undefined` for the default handling.
 */

/**
 * Converts ESLint flat config blocks to oxlint config.
 * @param {Array<Record<string, any>>} presetBlocks the blocks of the presets, in order
 * @param {{transformRule?: TransformRule, withNursery?: boolean}} [options] `withNursery` also converts rules in oxlint's nursery category
 * @returns {Promise<{
 *   config: import('oxlint').OxlintConfig,
 *   replayedRuleIDs: Map<string, string>,
 *   enabledReplayTargets: Set<string>,
 * }>} the config without the repo's own parts, the rule each replayed ESLint rule runs as, and the `core/` and `hosted/`
 * rules some block turns on
 */
async function convertPresets(presetBlocks, {transformRule, withNursery = false} = {}) {
    for (const block of presetBlocks) {
        if (block.files?.some(pattern => typeof pattern !== 'string')) {
            throw new Error('A preset block uses `files` that are not plain globs, which oxlint cannot express');
        }
    }
    const {blocks, renamed} = applyTransformRule(presetBlocks, transformRule);
    const {config: migrated, skipped} = await runMigrate(blocks, withNursery);

    // The files of the TypeScript preset's blocks, which stay TypeScript blocks when a repo re-scopes the preset.
    const typeScriptFiles = new Set(presetBlocks.filter(block => block[SOURCE_PRESET] === 'typescript' && block.files).map(block => JSON.stringify([...block.files].sort())));
    const isTypeScriptBlock = files => typeScriptFiles.has(JSON.stringify([...files].sort())) || files.some(file => TYPESCRIPT_GLOB.test(file));

    const replayedRuleIDs = new Map(
        [...skipped, ...ALWAYS_HOSTED].flatMap((ruleID) => {
            const target = getReplayTarget(ruleID, withNursery);
            return target ? [[ruleID, target]] : [];
        }),
    );
    const replayed = replaySkippedRules(blocks, replayedRuleIDs);

    // A rule the presets only ever turn off is left out of the config. It stays in the plugins, so a repo can still set it.
    const enabledReplayTargets = new Set([replayed.rules, ...replayed.overrides.map(override => override.rules)].flatMap(rules => Object.keys(rules).filter(rule => !isOff(rules[rule]))));
    const dropUnneededRules = rules => Object.fromEntries(Object.entries(rules).filter(([rule]) => !/^(core|hosted)\//.test(rule) || enabledReplayTargets.has(rule)));

    const specifiers = new Set([migrated, ...(migrated.overrides ?? [])].flatMap(block => block.jsPlugins ?? []));
    // eslint-plugin-rulesdir is replaced by plugins/rulesdir.mjs.
    specifiers.delete('eslint-plugin-rulesdir');

    /** @type {import('oxlint').OxlintConfig} */
    const config = {
        plugins: migrated.plugins,

        // oxlint reserves its own plugin names (`react`, `import`, `jsdoc`, ...), so the plugins above use other names.
        jsPlugins: [...specifiers].map(specifier => ({name: getJsPluginName(specifier), specifier: resolvePackage(specifier)})),
        categories: migrated.categories,
        options: {typeAware: true},
        ignorePatterns: migrated.ignorePatterns,
        env: migrated.env,
        globals: migrated.globals,
        settings: {...migrated.settings, ...getImportSettings(blocks)},
        rules: {...translateRules(migrated.rules), ...dropUnneededRules(replayed.rules), ...renamed.rules},
        overrides: [
            // jsPlugins are left out here; they are listed once at the root.
            ...(migrated.overrides ?? []).map(({
                files, plugins, env, globals, rules,
            }) => ({
                files,
                ...(plugins ? {plugins} : {}),
                ...(env ? {env} : {}),
                ...(globals ? {globals} : {}),
                ...(rules
                    ? {
                        rules: translateRules(
                            rules,
                            isTypeScriptBlock(files),
                        ),
                    }
                    : {}),
            })),
            ...replayed.overrides.map(({files, rules}) => ({files, rules: dropUnneededRules(rules)})),
            ...renamed.overrides,
        ],
    };
    return {config, replayedRuleIDs, enabledReplayTargets};
}

export {
    convertPresets, getJsPluginName, mergeSettings,
};
