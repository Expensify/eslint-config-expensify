/**
 * Loads every rule of eslint-plugin-expensify into oxlint under the `rulesdir` name. A repo that changes a rule builds its own
 * `rulesdir` plugin from `rules` and passes it as `plugins.rulesdir`. Rules that need type information are left out, because JS
 * plugins get none and they would throw on every file. The conversion drops or replaces the ones the presets enable.
 */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {definePlugin} from '../hosting.js';

const require = createRequire(import.meta.url);
const ruleDirectory = fileURLToPath(new URL('../../eslint-plugin-expensify/', import.meta.url));

const HELPER_FILES = new Set(['CONST.js']);

// Rules that call ESLintUtils.getParserServices, which oxlint JS plugins cannot provide.
const TYPE_INFORMATION_RULES = new Set(['boolean-conditional-rendering', 'prefer-at', 'prefer-locale-compare-from-context']);

const rules = {};
for (const file of fs.readdirSync(ruleDirectory)) {
    const name = file.replace(/\.js$/, '');
    if (file.endsWith('.js') && !HELPER_FILES.has(file) && !TYPE_INFORMATION_RULES.has(name)) {
        rules[name] = require(path.join(ruleDirectory, file));
    }
}

const plugin = definePlugin('rulesdir', rules);

export {rules};
export default plugin;
