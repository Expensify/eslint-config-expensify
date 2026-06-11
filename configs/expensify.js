import {defineConfig} from 'eslint/config';
import rulesdir from 'eslint-plugin-rulesdir';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import expensifyRules from '../rules/expensify.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
rulesdir.RULES_DIR = path.resolve(dirname, '../eslint-plugin-expensify');

const config = defineConfig([
    expensifyRules,
    {
        plugins: {
            rulesdir,
        },
    },
]);

export default config;
