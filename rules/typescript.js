import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';

const config = defineConfig([{
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    plugins: {
        '@typescript-eslint': tseslint.plugin,
        jsdoc,
    },
    languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            projectService: true,
        },
    },
    rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/prefer-enum-initializers': 'error',
        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],

        'no-undef': 'off',
        'no-redeclare': 'off',
        'import/named': 'off',
        'import/no-unresolved': 'off',

        'jsdoc/no-types': 'error',
        'jsdoc/require-param': 'off',
        'jsdoc/require-param-type': 'off',
        'jsdoc/check-param-names': 'off',
        'jsdoc/check-tag-names': 'off',
        'jsdoc/check-types': 'off',

        'es/no-optional-chaining': 'off',
        'es/no-nullish-coalescing-operators': 'off',
    },
}]);

export default config;
