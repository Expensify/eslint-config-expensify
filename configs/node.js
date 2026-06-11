import {defineConfig} from 'eslint/config';
import globals from 'globals';

import nodeRules from '../rules/base/node.js';

const config = defineConfig([
    ...nodeRules,
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
]);

export default config;
