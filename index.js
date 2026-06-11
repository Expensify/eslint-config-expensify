import {defineConfig} from 'eslint/config';
import globals from 'globals';

import browser from './configs/public/browser.js';
import node from './configs/public/node.js';
import react from './configs/public/react.js';
import typescript from './configs/public/typescript.js';
import expensify from './configs/public/expensify.js';

const config = defineConfig([
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
