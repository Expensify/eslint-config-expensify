import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';

const config = defineConfig([{
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    plugins: {
        '@typescript-eslint': tseslint.plugin,
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
        // Core no-redeclare does not understand TypeScript constructs (overloads, declaration merging, etc.)
        'no-redeclare': 'off',
        '@typescript-eslint/no-redeclare': 'error',

        // Core no-unused-vars can report false positives on type-only imports, enums, and other
        // TypeScript-specific constructs; the extension rule handles these correctly
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['error', {vars: 'all', args: 'after-used', ignoreRestSiblings: true}],

        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/prefer-enum-initializers': 'error',
        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
    },
}]);

export default config;
