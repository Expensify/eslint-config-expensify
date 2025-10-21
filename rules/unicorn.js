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
        
        // Enforce to use .replaceAll instead of .replace when dealing over regex searches 
        // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-replace-all.md
        'unicorn/prefer-string-replace-all': 'error',
        
        // Enforce to use set.size instead of Array.from(set).length for better performance
        // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-set-size.md
        'unicorn/prefer-set-size': 'error',       
    },
}]);

export default config;
