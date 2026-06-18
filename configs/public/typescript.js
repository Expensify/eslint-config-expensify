import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';

import bestPractices from '../private/best-practices.js';
import errors from '../private/errors.js';
import es6 from '../private/es6.js';
import imports from '../private/imports.js';
import style from '../private/style.js';
import variables from '../private/variables.js';
import formatting from './formatting.js';

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'];
const jsFiles = ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'];

function mergeConfigRules(...configArrays) {
    return Object.assign(
        {},
        ...configArrays.flatMap((configArray) => configArray
            .filter((entry) => entry.rules)
            .map((entry) => entry.rules)),
    );
}

const baseBestPracticesRules = mergeConfigRules(bestPractices);
const baseErrorsRules = mergeConfigRules(errors);
const baseES6Rules = mergeConfigRules(es6);
const baseImportsRules = mergeConfigRules(imports);
const baseStyleRules = mergeConfigRules(style, formatting);
const baseVariablesRules = mergeConfigRules(variables);

const importExtensionsRule = [
    baseImportsRules['import/extensions'][0],
    baseImportsRules['import/extensions'][1],
    {
        ...baseImportsRules['import/extensions'][2],
        ts: 'never',
        tsx: 'never',
        cts: 'never',
        mts: 'never',
    },
];

const importNoExtraneousDependenciesRule = [
    baseImportsRules['import/no-extraneous-dependencies'][0],
    {
        ...baseImportsRules['import/no-extraneous-dependencies'][1],
        devDependencies: baseImportsRules['import/no-extraneous-dependencies'][1].devDependencies.reduce((result, devDep) => {
            const toAppend = [devDep];
            const devDepWithTs = devDep.replace(/\bjs(x?)\b/g, 'ts$1');
            if (devDepWithTs !== devDep) {
                toAppend.push(devDepWithTs);
            }
            return [...result, ...toAppend];
        }, []),
    },
];

const scopedRecommendedTypeChecked = tseslint.configs.recommendedTypeChecked.map((block) => ({
    ...block,
    files: block.files || tsFiles,
}));

const scopedStylisticTypeChecked = tseslint.configs.stylisticTypeChecked.map((block) => ({
    ...block,
    files: block.files || tsFiles,
}));

const config = defineConfig([
    ...scopedRecommendedTypeChecked,
    ...scopedStylisticTypeChecked,
    {
        files: tsFiles,
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
        settings: {
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts', '.tsx', '.d.ts', '.cts', '.mts'],
            },
            'import/external-module-folders': ['node_modules', 'node_modules/@types'],
        },
        rules: {
            // Expensify airbnb-typescript equivalent: core rule → @typescript-eslint/* replacements
            // sourced from our private configs. Stylistic mappings (brace-style, indent, quotes,
            // etc.) are omitted because those rules moved out of @typescript-eslint in v8.
            'default-param-last': 'off',
            '@typescript-eslint/default-param-last': baseBestPracticesRules['default-param-last'],

            'dot-notation': 'off',
            '@typescript-eslint/dot-notation': baseBestPracticesRules['dot-notation'],

            'no-array-constructor': 'off',
            '@typescript-eslint/no-array-constructor': baseStyleRules['no-array-constructor'],

            'no-dupe-class-members': 'off',
            '@typescript-eslint/no-dupe-class-members': baseES6Rules['no-dupe-class-members'],

            'no-empty-function': 'off',
            '@typescript-eslint/no-empty-function': baseBestPracticesRules['no-empty-function'],

            'no-implied-eval': 'off',
            'no-new-func': 'off',
            '@typescript-eslint/no-implied-eval': baseBestPracticesRules['no-implied-eval'],

            'no-loss-of-precision': 'off',
            '@typescript-eslint/no-loss-of-precision': baseErrorsRules['no-loss-of-precision'],

            'no-loop-func': 'off',
            '@typescript-eslint/no-loop-func': baseBestPracticesRules['no-loop-func'],

            'no-magic-numbers': 'off',
            '@typescript-eslint/no-magic-numbers': baseBestPracticesRules['no-magic-numbers'],

            'no-redeclare': 'off',
            '@typescript-eslint/no-redeclare': baseBestPracticesRules['no-redeclare'],

            'no-shadow': 'off',
            '@typescript-eslint/no-shadow': baseVariablesRules['no-shadow'],

            'no-unused-expressions': 'off',
            '@typescript-eslint/no-unused-expressions': baseBestPracticesRules['no-unused-expressions'],

            'no-unused-vars': 'off',
            'no-use-before-define': 'off',

            'no-useless-constructor': 'off',
            '@typescript-eslint/no-useless-constructor': baseES6Rules['no-useless-constructor'],

            'require-await': 'off',
            '@typescript-eslint/require-await': baseBestPracticesRules['require-await'],

            'no-return-await': 'off',
            '@typescript-eslint/return-await': [baseBestPracticesRules['no-return-await'], 'in-try-catch'],

            'import/extensions': importExtensionsRule,
            'import/no-extraneous-dependencies': importNoExtraneousDependenciesRule,

            // Already checked (more thoroughly) by the TypeScript compiler.
            'constructor-super': 'off',
            'getter-return': 'off',
            'no-const-assign': 'off',
            'no-dupe-keys': 'off',
            'no-func-assign': 'off',
            'no-import-assign': 'off',
            'no-new-symbol': 'off',
            'no-obj-calls': 'off',
            'no-setter-return': 'off',
            'no-this-before-super': 'off',
            'no-undef': 'off',
            'no-unreachable': 'off',
            'no-unsafe-negation': 'off',
            'valid-typeof': 'off',

            // Recommended to disable within TypeScript projects.
            'import/named': 'off',
            'import/no-named-as-default-member': 'off',
            'import/no-unresolved': 'off',

            // Portable @typescript-eslint/* overrides from App (excluding path-scoped rules).
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

            // Requires eslint-config-expensify/expensify (rulesdir plugin).
            'rulesdir/prefer-at': 'error',
            'rulesdir/boolean-conditional-rendering': 'error',
        },
    },
    {
        files: jsFiles,
        ...tseslint.configs.disableTypeChecked,
    },
]);

export default config;
