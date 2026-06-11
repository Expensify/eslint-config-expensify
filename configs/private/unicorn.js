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

        // Enforce that .find or .findLast are used instead of .filter
        // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-find.md
        'unicorn/prefer-array-find': 'error',

        // Enforce to use set.size instead of Array.from(set).length for better performance
        // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-size.md
        'unicorn/prefer-set-size': 'error',

        // Enforce to use .replaceAll instead of .replace when dealing over regex searches
        // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-replace-all.md
        'unicorn/prefer-string-replace-all': 'error',
    },
}]);

export default config;
