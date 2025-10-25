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

        // Enforce that .find or .findLast are used instead of .filter
        // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-find.md
        'unicorn/prefer-array-find': 'error',
    },
}]);

export default config;
