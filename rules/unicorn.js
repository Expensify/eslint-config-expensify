import {defineConfig} from 'eslint/config';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

const config = defineConfig([{
    plugins: {
        unicorn: eslintPluginUnicorn,
    },

    languageOptions: {
        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
        },
    },

    rules: {
        // Enforce that .find or .findLast are used instead of .filter
        // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-find.md
        'unicorn/prefer-array-find': 'error',
    },
}]);

export default config;
