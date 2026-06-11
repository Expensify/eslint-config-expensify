import {defineConfig} from 'eslint/config';
import globals from 'globals';

import base from './configs/base.js';
import react from './configs/react.js';
import typescript from './configs/typescript.js';
import expensify from './configs/expensify.js';

const config = defineConfig([
    ...base,
    ...react,
    ...typescript,
    ...expensify,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jquery,
                ...globals.node,
            },
        },
    },
]);

export default config;
