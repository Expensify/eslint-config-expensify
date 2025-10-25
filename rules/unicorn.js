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

        // Enforce to use .replaceAll instead of .replace when dealing over regex searches
        // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-replace-all.md
        'unicorn/prefer-string-replace-all': 'error',
    },
}]);

export default config;
