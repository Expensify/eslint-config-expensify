import {defineConfig} from 'eslint/config';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

const config = defineConfig([{
    plugins: {unicorn},

    languageOptions: {
        parserOptions: {
            globals: globals.builtin,
        },
    },

    rules: {
        'unicorn/prefer-set-has': 'error',
        'unicorn/no-array-for-each': 'error',
    },
}]);

export default config;
