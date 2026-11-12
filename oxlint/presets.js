/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * Loads the presets of this package, and eslint-config-prettier, as ESLint flat config blocks for convert.js.
 */
import prettierConfig from 'eslint-config-prettier';

import {MERGED_IMPORT_SETTINGS, isCopiedImportSetting} from './tables.js';

// The names of this package's own exports (see "exports" in package.json) that hold ESLint config.
const PRESET_NAMES = ['browser', 'expensify', 'formatting', 'jest', 'node', 'react', 'react-formatting', 'scripts', 'typescript'];

// The names `presets` accepts, for error messages: the exports above and eslint-config-prettier.
const VALID_PRESETS = [...PRESET_NAMES, 'prettier'].join(', ');

// The preset lists generated/rules.json is computed over: every export on its own, and the usual combinations. One list
// with everything would not work: the conversion refuses an unscoped block that follows a scoped one for the same rule
// (`formatting` after `typescript`).
const RULE_SOURCE_LISTS = [
    ...PRESET_NAMES.map(name => [name]),
    ['browser', 'react', 'expensify', 'typescript', 'scripts', 'jest', 'prettier'],
    ['node', 'react', 'typescript', 'scripts', 'jest', 'prettier'],

    // Re-scoped to `files`, which moves some rules from the root into overrides, and changes which ones oxlint skips.
    // `react` is left out: its settings cannot be scoped to files, so re-scoping it is not supported.
    ...PRESET_NAMES.filter(preset => preset !== 'react').map(preset => [{preset, files: ['src/**']}]),
];

/**
 * @typedef {import('./index.d.ts').PresetEntry} PresetEntry
 */

// `files` that only pick file types, like the typescript preset's `**/*.ts` and `**/*.js` blocks.
const FILE_TYPE_GLOB = /^\*\*\/\*\.[\w.]+$/;
const GLOB_SYNTAX = /[*?{}[\]!]/;

/**
 * Returns the parts of a glob of `files` that match only files of the given types. The type is read from the last part
 * of the glob: `src/**` gives `src/**\/*.ts` for `.ts`, `src/**\/*.{js,ts}` gives `src/**\/*.ts`, `src/foo-*.d.ts` is kept
 * for `.ts`, and `setup.js` gives nothing. A wildcard name must end with a plain extension, like `foo-*.ts`.
 * @param {string} glob
 * @param {string[]} extensions like `.ts`
 * @returns {string[] | undefined} undefined when the last part of the glob can match files of any type, like `src/*` or
 * `src/index.*`
 */
function narrowToExtensions(glob, extensions) {
    const directory = glob.slice(0, glob.lastIndexOf('/') + 1);
    const name = glob.slice(directory.length);
    if (name === '**') {
        return extensions.map(extension => `${glob}/*${extension}`);
    }
    const braces = /^([^{}]*)\{([^{}]+)\}([^{}]*)$/.exec(name);
    const names = braces ? braces[2].split(',').map(option => `${braces[1]}${option}${braces[3]}`) : [name];

    // The text after the last dot must have no wildcard. A name without a dot is all extension, so `foo*` is refused too.
    // `**` inside a name matches like `*` in both ESLint and oxlint, so `src/**.ts` is read as `src/*.ts`.
    const hasUnknownType = option => GLOB_SYNTAX.test(option) && GLOB_SYNTAX.test(option.slice(option.lastIndexOf('.') + 1));
    if (names.some(hasUnknownType)) {
        return undefined;
    }
    return names.filter(option => extensions.some(extension => option.endsWith(extension))).map(option => `${directory}${option}`);
}

/**
 * Runs a preset block on `files` only:
 * - A block for some file types (`**\/*.ts`) keeps them inside `files`: `src/**` gives `src/**\/*.ts`.
 * - Any other block gets `files` instead of its own.
 * @param {Record<string, any>} block
 * @param {string[]} files
 * @param {string} preset
 * @returns {Record<string, any> | undefined} undefined when no file of `files` has the block's types
 */
function limitBlock(block, files, preset) {
    if (!block.files?.every(glob => FILE_TYPE_GLOB.test(glob))) {
        return {...block, files};
    }
    const extensions = block.files.map(glob => glob.slice('**/*'.length));
    const limited = files.flatMap((glob) => {
        const narrowed = narrowToExtensions(glob, extensions);
        if (!narrowed) {
            throw new Error(
                `The "${preset}" preset has blocks for ${block.files.join(', ')}, so each of its files must name a file type `
                + `(like \`dir/**/*.ts\` or \`setup.js\`) or be a folder (\`dir/**\`). Got ${glob}.`,
            );
        }
        return narrowed;
    });
    return limited.length ? {...block, files: limited} : undefined;
}

/**
 * Throws when a preset block for some files only sets an `import/*` setting that convert.js would apply to every file,
 * unless MERGED_IMPORT_SETTINGS says that is safe. Runs on the blocks as the preset ships them, so `npm run build:oxlint`
 * fails here before a repo gets the preset.
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
 * @param {unknown} entry
 */
function checkPresetEntry(entry) {
    if (typeof entry === 'string') {
        return;
    }
    if (typeof entry?.preset !== 'string') {
        throw new Error(`A preset entry is a name or {preset, files}, but got ${JSON.stringify(entry)}. Valid presets: ${VALID_PRESETS}.`);
    }
    if (entry.files !== undefined && !(Array.isArray(entry.files) && entry.files.length && entry.files.every(file => typeof file === 'string'))) {
        throw new Error(`The files of the "${entry.preset}" preset must be a non-empty array of strings, but got ${JSON.stringify(entry.files)}.`);
    }
}

/**
 * Loads the ESLint config blocks of the presets, in order.
 * @param {PresetEntry[]} presets
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function loadPresetBlocks(presets) {
    for (const entry of presets) {
        checkPresetEntry(entry);
    }
    const lists = await Promise.all(
        presets.map(async (entry) => {
            const preset = getPresetName(entry);

            // An entry that is a name is the preset name itself, with no files.
            const files = entry === preset ? undefined : entry.files;
            const blocks = await loadPreset(preset);
            if (!files) {
                return blocks;
            }
            const settingKeys = blocks.flatMap(block => (block.files ? [] : Object.keys(block.settings ?? {}))).filter(key => !key.startsWith('import/'));
            if (settingKeys.length) {
                throw new Error(`The "${preset}" preset sets ${[...new Set(settingKeys)].join(', ')} for all files, so it cannot be limited to files: oxlint has no per-file settings.`);
            }
            const limited = blocks.map(block => limitBlock(block, files, preset)).filter(Boolean);
            if (!limited.some(block => block.rules)) {
                throw new Error(`The "${preset}" preset applies to none of ${files.join(', ')}, since its rules are for other file types.`);
            }
            return limited;
        }),
    );
    return lists.flat();
}

export {
    RULE_SOURCE_LISTS, checkScopedImportSettings, getPresetName, loadPresetBlocks,
};
