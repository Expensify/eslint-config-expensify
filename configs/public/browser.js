import {defineConfig} from 'eslint/config';
import globals from 'globals';

import base from '../private/base.js';

const config = defineConfig([
    ...base,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },
]);

export default config;
