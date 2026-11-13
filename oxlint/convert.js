/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * Turns eslint-config-expensify presets (ESLint flat config blocks) into oxlint config with @oxlint/migrate. Rules oxlint cannot
 * run itself are replayed as `core/<rule>` or `hosted/<rule>` from ESLint's own code (see ./plugins). If a preset rule cannot run
 * either way, the conversion stops until the rule is listed in tables.js, so no rule is lost without a decision.
 */
import migrate from '@oxlint/migrate';
import {builtinRules} from 'eslint/use-at-your-own-risk';

import {
    getPluginRules, resolvePackage, splitRuleID, withReactHooksID,
} from './hosting.js';
import {
    REPLAYED_RULE_NAME, getSeverity, isOff, ruleMapsOf, toEntryArray,
} from './rule-entry.js';
import {CLASSIC_REACT_HOOKS_RULES, reactCompilerRuleNames} from './react-compiler-rules.js';
import {
    ALWAYS_HOSTED,
    DEFAULT_SETTINGS,
    DROPPED_RULES,
    DROPPED_SETTINGS_WARNINGS,
    DROPPED_WITHOUT_NURSERY,
    DROP_OPTIONS,
    EXPECTED_WARNINGS,
    HOSTED_PLUGIN_PACKAGES,
    NURSERY_RULES_RUN_NATIVE,
    STAND_INS,
    STUBBED_PARSER_SERVICES,
    TYPED_CORE_EQUIVALENTS,
    isCopiedImportSetting,
} from './tables.js';

const REACT_COMPILER_RULES = new Set(reactCompilerRuleNames);

const TYPESCRIPT_GLOB = /\.(\{[^}]*\b)?[cm]?tsx?\b/;

/**
 * @param {unknown} value
 * @returns {boolean} whether the value is a plain object, not an array
 */
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

/**
 * Merges oxlint settings. Nested objects are merged key by key. Any other value in `extra` replaces the one in `base`.
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} extra
 * @returns {Record<string, unknown>} a new object, so neither argument is changed
 */
function mergeSettings(base, extra) {
    const merged = {...base};
    for (const [key, value] of Object.entries(extra)) {
        merged[key] = isObject(value) && isObject(merged[key]) ? mergeSettings(merged[key], value) : value;
    }
    return merged;
}

/**
 * Collects rules that run under a new name: rules `@oxlint/migrate` skipped, and rules `transformRule` renamed. Each rule
 * keeps the files of the preset block it came from. Blocks must be added in preset order, because a later block that sets
 * only a severity keeps the options of an earlier one, as in ESLint. An unscoped block after a scoped one for the same
 * rule throws: oxlint applies `overrides` after the root `rules`, so the unscoped setting would lose to the scoped one,
 * where ESLint lets the later block win.
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
        const [severity, ...options] = toEntryArray(entry);
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
                throw new Error('A preset block has both rules and ignores, which this conversion does not support');
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
 * Applies `transformRule` to every preset rule, and rejects react-hooks rules the installed plugin does not have. Renamed rules
 * come back in `renamed`, collected like the replayed rules, and in `renamedRuleIDs`, which maps each ESLint rule ID to its new name.
 * @param {Array<Record<string, any>>} blocks ESLint flat config blocks
 * @param {TransformRule | undefined} transformRule
 * @returns {{
 *   blocks: Array<Record<string, any>>,
 *   renamed: ReturnType<ReturnType<typeof createRuleCollector>['result']>,
 *   renamedRuleIDs: Map<string, string>,
 * }}
 */
function applyTransformRule(blocks, transformRule) {
    const collector = createRuleCollector();
    const renamedRuleIDs = new Map();
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
                renamedRuleIDs.set(ruleID, result[0]);
                continue;
            }
            const {prefix, name} = splitRuleID(ruleID);
            if (prefix === 'react-hooks' && !CLASSIC_REACT_HOOKS_RULES.has(name) && !REACT_COMPILER_RULES.has(name)) {
                throw new Error(
                    `${ruleID} is set by a preset, but the installed eslint-plugin-react-hooks has no such rule. `
                    + 'Drop or rename it in transformRule, or install the eslint-plugin-react-hooks version eslint-config-expensify expects.',
                );
            }
            rules[ruleID] = entry;
        }
        collector.add(block, hits);
        return {...block, rules};
    });
    return {blocks: prepared, renamed: collector.result(), renamedRuleIDs};
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
 * Runs @oxlint/migrate twice. The run with type information gives the config. The run without it finds the core rules
 * oxlint has no untyped version of. TYPED_CORE_EQUIVALENTS (like `dot-notation`) are left out of the typed run, so they
 * are skipped and run as `core/`.
 * @param {Array<Record<string, any>>} blocks
 * @param {boolean} withNursery whether @oxlint/migrate also converts rules oxlint still keeps in its nursery category
 * @returns {Promise<{config: Record<string, any>, skipped: Set<string>}>} the converted config, and the ESLint IDs of the
 * preset rules it could not convert
 */
async function runMigrate(blocks, withNursery) {
    const skipped = new Set();
    const withoutTypedCoreEquivalents = blocks.map((block) => {
        if (!block.rules) {
            return block;
        }
        const rules = Object.entries(block.rules).filter(([ruleID]) => !TYPED_CORE_EQUIVALENTS.has(ruleID));
        return {...block, rules: Object.fromEntries(rules)};
    });
    const run = async (typeAware) => {
        const skippedHere = new Map();
        const reporter = {
            addWarning: (warning) => {
                if (isExpectedWarning(warning, blocks)) {
                    return;
                }
                throw new Error(`@oxlint/migrate: ${warning}\neslint-config-expensify stops on warnings it does not expect. Handle it in its oxlint/convert.js or tables.js.`);
            },
            getWarnings: () => [],
            markSkipped: (rule, category) => skippedHere.set(`${rule}\0${category}`, rule),
            removeSkipped: (rule, category) => skippedHere.delete(`${rule}\0${category}`),
            getSkippedRulesByCategory: () => ({}),
        };
        const config = await migrate(typeAware ? withoutTypedCoreEquivalents : blocks, undefined, {
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
 * Returns the rule that runs a preset rule @oxlint/migrate skipped, or an ALWAYS_HOSTED one: `core/<name>` or
 * `hosted/<name>`, or the rule's own name for a NURSERY_RULES_RUN_NATIVE one. Deprecated core rules like no-new-object
 * run as `core/` too, because oxlint's replacement for them reports more than ESLint's rule does.
 * @param {string} ruleID an ESLint rule ID
 * @param {boolean} withNursery
 * @returns {string | undefined} undefined for rules in DROPPED_RULES or STAND_INS
 */
function getReplayTarget(ruleID, withNursery) {
    if (DROPPED_RULES[ruleID] || STAND_INS[ruleID] || (!withNursery && DROPPED_WITHOUT_NURSERY[ruleID])) {
        return undefined;
    }
    if (NURSERY_RULES_RUN_NATIVE.has(ruleID)) {
        return ruleID;
    }
    const {prefix, name} = splitRuleID(ruleID);
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
    throw new Error(`oxlint cannot run ${ruleID} natively or as a JS plugin. ${fix} in oxlint/tables.js.`);
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
 * @param {Set<string>} alwaysHosted the ESLint rule IDs that run as `hosted/` and so are skipped here
 * @returns {Record<string, unknown>}
 */
function translateRules(rules, isTypeScriptBlock, alwaysHosted) {
    const out = {};
    for (const [ruleID, entry] of Object.entries(rules ?? {})) {
        // ALWAYS_HOSTED rules come back as `hosted/` through replaySkippedRules, and DROPPED_RULES do not run at all.
        // @oxlint/migrate writes react-hooks rules under `react/`, so both IDs are checked.
        if (withReactHooksID(ruleID).some(id => alwaysHosted.has(id) || DROPPED_RULES[id])) {
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
 * blocks are merged. presets.js checks that a setting for some files only is safe to merge (MERGED_IMPORT_SETTINGS).
 * `import/parsers` is skipped because oxlint does not have it.
 * @param {Array<Record<string, any>>} blocks
 * @returns {Record<string, unknown>}
 */
function getImportSettings(blocks) {
    let settings = {};
    for (const block of blocks) {
        const entries = Object.entries(block.settings ?? {}).filter(([key]) => isCopiedImportSetting(key));
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
 * @typedef {import('./index.d.ts').TransformRule} TransformRule
 */

/**
 * Converts ESLint flat config blocks to oxlint config.
 * @param {Array<Record<string, any>>} presetBlocks the blocks of the presets, in order
 * @param {object} [options]
 * @param {TransformRule} [options.transformRule] called for each preset rule with its ESLint rule ID, before conversion
 * @param {boolean} [options.withNursery] also converts rules in oxlint's nursery category
 * @param {string[]} [options.nativeRules] ALWAYS_HOSTED rule IDs that keep oxlint's own version
 * @returns {Promise<{config: import('oxlint').OxlintConfig, replayedRuleIDs: Map<string, string>, renamedRuleIDs: Map<string, string>}>}
 * the config without the repo's own parts, the rule each replayed ESLint rule runs as, and the new name of each rule
 * `transformRule` renamed
 */
async function convertPresets(presetBlocks, {transformRule, withNursery = false, nativeRules = []} = {}) {
    const alwaysHosted = new Set([...ALWAYS_HOSTED].filter(ruleID => !nativeRules.includes(ruleID)));
    for (const block of presetBlocks) {
        if (block.files?.some(pattern => typeof pattern !== 'string')) {
            throw new Error('A preset block uses `files` that are not plain globs, which oxlint cannot express');
        }
    }

    // ESLint matches a `files` glob without a slash, like the jest preset's `jestSetup.js`, against the root only. oxlint
    // matches it at every depth unless it starts with `./`.
    const anchored = presetBlocks.map(block => (block.files ? {...block, files: block.files.map(glob => (glob.includes('/') ? glob : `./${glob}`))} : block));
    const {blocks, renamed, renamedRuleIDs} = applyTransformRule(anchored, transformRule);
    const {config: migrated, skipped} = await runMigrate(blocks, withNursery);

    const isTypeScriptBlock = files => files.some(file => TYPESCRIPT_GLOB.test(file));

    const replayedRuleIDs = new Map(
        [...skipped, ...alwaysHosted].flatMap((ruleID) => {
            const target = getReplayTarget(ruleID, withNursery);
            return target ? [[ruleID, target]] : [];
        }),
    );
    const replayed = replaySkippedRules(blocks, replayedRuleIDs);

    // A rule the presets only ever turn off is left out of the config. It stays in the plugins, so a repo can still set it.
    const enabledReplayTargets = new Set(ruleMapsOf(replayed).flatMap(rules => Object.keys(rules).filter(rule => !isOff(rules[rule]))));
    const isReplayedName = rule => REPLAYED_RULE_NAME.test(rule) || NURSERY_RULES_RUN_NATIVE.has(rule);
    const dropUnneededRules = rules => Object.fromEntries(Object.entries(rules).filter(([rule]) => !isReplayedName(rule) || enabledReplayTargets.has(rule)));

    // A rule `transformRule` renamed is written as asked, but still gets the option fixes oxlint needs. The empty set keeps
    // translateRules from dropping it as always hosted, since the repo chose its name.
    const translateRenamed = (rules, isTypeScript) => translateRules(rules, isTypeScript, new Set());

    const specifiers = new Set([migrated, ...(migrated.overrides ?? [])].flatMap(block => block.jsPlugins ?? []));
    // eslint-plugin-rulesdir is replaced by plugins/rulesdir.js.
    specifiers.delete('eslint-plugin-rulesdir');

    /** @type {import('oxlint').OxlintConfig} */
    const config = {
        // Every plugin an override uses is also listed here, or oxlint ignores its rules in that override (an override that turns off
        // a `typescript/` rule would do nothing). With `categories` off, a listed plugin runs only the rules set. A native nursery rule, which migrate skips, adds its plugin.
        plugins: [...new Set([
            ...(migrated.plugins ?? []),
            ...(migrated.overrides ?? []).flatMap(override => override.plugins ?? []),
            ...[...enabledReplayTargets].filter(rule => NURSERY_RULES_RUN_NATIVE.has(rule)).map(rule => splitRuleID(rule).prefix),
        ])],

        // JS plugins are named after their package (see getJsPluginName). oxlint reserves some plugin names (see HOSTED_PLUGIN_PACKAGES), so those rules run as `hosted/`.
        jsPlugins: [...specifiers].map(specifier => ({name: getJsPluginName(specifier), specifier: resolvePackage(specifier)})),
        categories: migrated.categories,

        // reportUnusedDisableDirectives stays off, see the README.
        options: {typeAware: true},
        ignorePatterns: migrated.ignorePatterns,
        env: migrated.env,
        globals: migrated.globals,
        settings: {...migrated.settings, ...getImportSettings(blocks)},
        rules: {...translateRules(migrated.rules, false, alwaysHosted), ...dropUnneededRules(replayed.rules), ...translateRenamed(renamed.rules, false)},
        overrides: [
            // jsPlugins are left out here, they are listed once at the root.
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
                            alwaysHosted,
                        ),
                    }
                    : {}),
            })),
            ...replayed.overrides.map(({files, rules}) => ({files, rules: dropUnneededRules(rules)})),
            ...renamed.overrides.map(({files, rules}) => ({files, rules: translateRenamed(rules, isTypeScriptBlock(files))})),
        ],
    };
    return {config, replayedRuleIDs, renamedRuleIDs};
}

export {
    convertPresets, mergeSettings,
};
