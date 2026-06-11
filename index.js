import {defineConfig} from 'eslint/config';
import globals from 'globals';

import base from './configs/base.js';
import browser from './configs/browser.js';
import node from './configs/node.js';
import react from './configs/react.js';
import typescript from './configs/typescript.js';
import expensify from './configs/expensify.js';

const config = defineConfig([
    ...base,
    ...browser,
    ...node,
    ...react,
    ...typescript,
    ...expensify,
    {
        languageOptions: {
            globals: {
                ...globals.jquery,
            },
        },
    },
]);

export default config;
