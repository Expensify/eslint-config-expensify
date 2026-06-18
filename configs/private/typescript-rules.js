import {defineConfig} from 'eslint/config';

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'];

/**
 * Expensify TypeScript rule overrides layered on top of typescript-eslint presets
 * and the Expensify airbnb-typescript equivalent. Mirrors portable rules from App's
 * eslint.config.mjs (excluding App-only path overrides and allowlists).
 */
const config = defineConfig([
    {
        files: tsFiles,
        rules: {
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-unsafe-type-assertion': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': ['error', {considerDefaultExhaustiveForUnions: true}],
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/max-params': ['error', {max: 10}],
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: ['variable', 'property'],
                    format: null,
                    filter: {
                        regex: '^__esModule$',
                        match: true,
                    },
                },
                {
                    selector: ['variable', 'property'],
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    filter: {
                        regex: '^private_[a-z][a-zA-Z0-9]*$',
                        match: false,
                    },
                },
                {
                    selector: 'function',
                    format: ['camelCase', 'PascalCase'],
                },
                {
                    selector: ['typeLike', 'enumMember'],
                    format: ['PascalCase'],
                },
                {
                    selector: ['parameter', 'method'],
                    format: ['camelCase', 'PascalCase'],
                    leadingUnderscore: 'allow',
                },
            ],
            '@typescript-eslint/no-restricted-types': [
                'error',
                {
                    types: {
                        object: "Use 'Record<string, T>' instead.",
                    },
                },
            ],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                    fixStyle: 'separate-type-imports',
                },
            ],
            '@typescript-eslint/consistent-type-exports': [
                'error',
                {
                    fixMixedExportsWithInlineTypeSpecifier: false,
                },
            ],
            '@typescript-eslint/no-use-before-define': ['error', {functions: false}],
            '@typescript-eslint/no-deprecated': 'error',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/prefer-enum-initializers': 'error',
            '@typescript-eslint/no-import-type-side-effects': 'error',
            '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
        },
    },
    {
        files: tsFiles,
        rules: {
            // ESLint 9 parity: prefer core rules where the @typescript-eslint variants moved or changed.
            'lines-between-class-members': ['error', 'always', {exceptAfterSingleLine: false}],
            '@typescript-eslint/lines-between-class-members': 'off',

            '@typescript-eslint/no-duplicate-type-constituents': ['error', {ignoreUnions: true}],
            '@typescript-eslint/no-require-imports': 'off',

            'no-throw-literal': 'error',
            '@typescript-eslint/no-throw-literal': 'off',
            '@typescript-eslint/only-throw-error': 'off',

            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    args: 'after-used',
                    caughtErrors: 'none',
                    ignoreRestSiblings: true,
                },
            ],
            '@typescript-eslint/prefer-find': 'off',
            '@typescript-eslint/prefer-includes': 'off',
            '@typescript-eslint/prefer-optional-chain': 'off',
            '@typescript-eslint/prefer-nullish-coalescing': [
                'error',
                {
                    ignoreIfStatements: true,
                    ignorePrimitives: {},
                    ignoreTernaryTests: true,
                },
            ],
            'prefer-promise-reject-errors': 'error',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
            '@typescript-eslint/prefer-regexp-exec': 'off',
        },
    },
    {
        files: tsFiles,
        rules: {
            // Requires eslint-config-expensify/expensify (rulesdir plugin).
            'rulesdir/prefer-at': 'error',
            'rulesdir/boolean-conditional-rendering': 'error',
        },
    },
]);

export default config;
