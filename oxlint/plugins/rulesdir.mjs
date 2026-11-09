/**
 * Loads every rule of eslint-plugin-expensify into oxlint, under the `rulesdir` name ESLint uses. A repo that changes a
 * rule builds its own plugin named `rulesdir` from `rules` and passes it as `plugins.rulesdir`.
 *
 * Rules that need type information (boolean-conditional-rendering, prefer-at) throw when they run, because JS plugins
 * get none. The conversion drops or replaces them, so presets never enable them here.
 */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const ruleDirectory = fileURLToPath(new URL('../../eslint-plugin-expensify/', import.meta.url));

// Files in the directory that are not rules.
const HELPER_FILES = new Set(['CONST.js']);

const rules = {};
for (const file of fs.readdirSync(ruleDirectory)) {
    if (file.endsWith('.js') && !HELPER_FILES.has(file)) {
        rules[file.replace(/\.js$/, '')] = require(path.join(ruleDirectory, file));
    }
}

const plugin = {
    meta: {
        name: 'rulesdir',
        version: '0.0.1',
    },
    rules,
};

export {rules};
export default plugin;
