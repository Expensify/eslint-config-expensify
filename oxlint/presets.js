/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * Loads the presets of this package, and eslint-config-prettier, as ESLint flat config blocks for convert.js.
 */
import prettierConfig from 'eslint-config-prettier';

import {MERGED_IMPORT_SETTINGS, isCopiedImportSetting} from './tables.js';

// The names of this package's own exports (see "exports" in package.json) that hold ESLint config.
const PRESET_NAMES = ['browser', 'expensify', 'formatting', 'jest', 'node', 'react', 'react-formatting', 'scripts', 'typescript'];

const VALID_PRESETS = [...PRESET_NAMES, 'prettier'].join(', ');

// The preset lists generated/rules.json is computed over: every export on its own, and the usual combinations. One list
// with everything would not work: the conversion refuses an unscoped block that follows a scoped one for the same rule
// (`formatting` after `typescript`).
const RULE_SOURCE_LISTS = [
    ...PRESET_NAMES.map(name => [name]),
    ['browser', 'react', 'expensify', 'typescript', 'scripts', 'jest', 'prettier'],
    ['node', 'react', 'typescript', 'scripts', 'jest', 'prettier'],

    // Re-scoped to `files`, which moves some rules from the root into overrides, and changes which ones oxlint skips.
    // `react` and the presets for file types are left out, since they cannot be limited to files.
    ...PRESET_NAMES.filter(preset => !['browser', 'node', 'react', 'typescript'].includes(preset)).map(preset => [{preset, files: ['src/**']}]),
];

/**
 * @typedef {import('./index.d.ts').PresetEntry} PresetEntry
 */

// `files` that only pick file types, like the typescript preset's `**/*.ts` and `**/*.js` blocks.
const FILE_TYPE_GLOB = /^\*\*\/\*\.[\w.]+$/;

/**
 * Throws when a preset block for some files only sets an `import/*` setting that convert.js would apply to every file, unless
 * MERGED_IMPORT_SETTINGS says that is safe. It runs on the blocks as shipped, so `npm run build:oxlint` fails here first.
 * @param {string} name
 * @param {Array<Record<string, any>>} blocks
 */
function checkScopedImportSettings(name, blocks) {
    for (const block of blocks) {
        if (!block.files) {
            continue;
        }
        const unchecked = Object.keys(block.settings ?? {}).filter(key => isCopiedImportSetting(key) && !MERGED_IMPORT_SETTINGS[key]);
        if (unchecked.length) {
            throw new Error(
                `The "${name}" preset sets ${unchecked.join(', ')} for ${block.files.join(', ')} only, but oxlint has no per-file settings, so `
                + 'the oxlint config would apply it to every file. Check that this gives the same result on every file and add it to '
                + 'MERGED_IMPORT_SETTINGS in oxlint/tables.js, or set it for all files.',
            );
        }
    }
}

/**
 * @param {string} name
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function loadPreset(name) {
    if (name === 'prettier') {
        return [prettierConfig];
    }
    if (!PRESET_NAMES.includes(name)) {
        throw new Error(`Unknown preset "${name}". Use one of: ${VALID_PRESETS}.`);
    }
    const module = await import(`../configs/public/${name}.js`);
    const blocks = [module.default].flat();
    checkScopedImportSettings(name, blocks);
    return blocks;
}

/**
 * @param {PresetEntry} entry
 * @returns {string} the name of the preset the entry loads
 */
const getPresetName = entry => (typeof entry === 'string' ? entry : entry.preset);

/**
 * Loads the ESLint config blocks of the presets, in order. `{preset, files}` runs the preset on `files` only: they replace the
 * `files` of each block, like `{...block, files}`. That does not work for a preset for file types, nor for one with settings for all files.
 * @param {PresetEntry[]} presets
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function loadPresetBlocks(presets) {
    const lists = await Promise.all(
        presets.map(async (entry) => {
            const preset = getPresetName(entry);

            const files = entry === preset ? undefined : entry.files;
            const blocks = await loadPreset(preset);
            if (!files) {
                return blocks;
            }
            const fileTypeBlock = blocks.find(block => block.files?.every(glob => FILE_TYPE_GLOB.test(glob)));
            if (fileTypeBlock) {
                throw new Error(
                    `The "${preset}" preset is for file types (${fileTypeBlock.files[0]}), so it cannot be limited to files. Limit presets whose blocks target locations, like "jest".`,
                );
            }
            const settingKeys = blocks.flatMap(block => (block.files ? [] : Object.keys(block.settings ?? {})));
            if (settingKeys.length) {
                throw new Error(`The "${preset}" preset sets ${[...new Set(settingKeys)].join(', ')} for all files, so it cannot be limited to files: oxlint has no per-file settings.`);
            }
            return blocks.map(block => ({...block, files}));
        }),
    );
    return lists.flat();
}

export {
    RULE_SOURCE_LISTS, checkScopedImportSettings, getPresetName, loadPresetBlocks,
};
