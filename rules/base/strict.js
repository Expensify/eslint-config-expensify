import {defineConfig} from 'eslint/config';

const config = defineConfig([{
    rules: {
        // babel inserts `'use strict';` for us
        strict: ['error', 'never'],
    },
}]);

export default config;
