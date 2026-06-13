import {defineConfig} from 'eslint/config';
import jestPlugin from 'eslint-plugin-jest';
import globals from 'globals';

import jestFiles from '../constants/jest-files.js';

const config = defineConfig([{
    files: jestFiles,
    ...jestPlugin.configs['flat/recommended'],
    ...jestPlugin.configs['flat/style'],
    languageOptions: {
        globals: {
            ...globals.jest,
        },
    },
    rules: {
        'no-console': 'off',
        'no-await-in-loop': 'off',
        'no-import-assign': 'off',
    },
}]);

export default config;
