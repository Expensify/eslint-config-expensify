/**
 * Loads the presets of this package, and eslint-config-prettier, as ESLint flat config blocks for convert.mjs.
 */
import prettierConfig from 'eslint-config-prettier';

// The names of this package's own exports (see "exports" in package.json) that hold ESLint config.
const PRESET_NAMES = ['browser', 'expensify', 'formatting', 'jest', 'node', 'react', 'react-formatting', 'scripts', 'typescript'];

// The preset lists generated/rules.json is computed over: every export on its own, and the usual combinations. One list
// with everything would not work: the conversion refuses an unscoped block that follows a scoped one for the same rule
// (`formatting` after `typescript`), which is what a repo's own order avoids.
const RULE_SOURCE_LISTS = [
    ...PRESET_NAMES.map(name => [name]),
    ['browser', 'react', 'expensify', 'typescript', 'scripts', 'jest', 'prettier'],
    ['node', 'react', 'typescript', 'scripts', 'jest', 'prettier'],
];

/**
 * @typedef {string | {preset: string, files: string[]}} PresetEntry
 * A preset name (`'prettier'` is eslint-config-prettier, which turns off the rules oxfmt or Prettier handles), or an
 * object that re-scopes every block of the preset to `files`.
 */

/**
 * @param {string} name
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function loadPreset(name) {
    if (name === 'prettier') {
        return [prettierConfig];
    }
    if (!PRESET_NAMES.includes(name)) {
        throw new Error(`Unknown preset "${name}". Use one of: ${[...PRESET_NAMES, 'prettier'].join(', ')}.`);
    }
    const module = await import(`../configs/public/${name}.js`);
    return [module.default].flat();
}

/**
 * Loads the ESLint config blocks of the presets, in order.
 * @param {PresetEntry[]} presets
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function loadPresetBlocks(presets) {
    const lists = await Promise.all(
        presets.map(async (entry) => {
            const {preset, files} = typeof entry === 'string' ? {preset: entry, files: undefined} : entry;
            const blocks = await loadPreset(preset);
            return files ? blocks.map(block => ({...block, files})) : blocks;
        }),
    );
    return lists.flat();
}

export {PRESET_NAMES, RULE_SOURCE_LISTS, loadPresetBlocks};
