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

        // Enforce to use set.size instead of Array.from(set).length for better performance
        // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-size.md
        'unicorn/prefer-set-size': 'error',
    },
}]);

export default config;
