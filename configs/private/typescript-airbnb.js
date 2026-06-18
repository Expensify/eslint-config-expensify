import {defineConfig} from 'eslint/config';

import bestPractices from './best-practices.js';
import errors from './errors.js';
import es6 from './es6.js';
import imports from './imports.js';
import style from './style.js';
import variables from './variables.js';
import formatting from '../public/formatting.js';
import mergeConfigRules from './typescript-utils.js';

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'];

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

/**
 * Expensify's TypeScript rule replacements, adapted from eslint-config-airbnb-typescript
 * but sourcing base rule options from eslint-config-expensify's private configs instead
 * of eslint-config-airbnb-base.
 *
 * Stylistic core-to-TS rule mappings (brace-style, indent, quotes, etc.) are omitted
 * because those rules moved out of @typescript-eslint in v8. Formatting for TypeScript
 * files continues to come from eslint-config-expensify/formatting.
 */
const config = defineConfig([
    {
        files: tsFiles,
        settings: {
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts', '.tsx', '.d.ts', '.cts', '.mts'],
            },
            'import/external-module-folders': ['node_modules', 'node_modules/@types'],
        },
        rules: {
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
            '@typescript-eslint/no-unused-vars': baseVariablesRules['no-unused-vars'],

            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': baseVariablesRules['no-use-before-define'],

            'no-useless-constructor': 'off',
            '@typescript-eslint/no-useless-constructor': baseES6Rules['no-useless-constructor'],

            'require-await': 'off',
            '@typescript-eslint/require-await': baseBestPracticesRules['require-await'],

            'no-return-await': 'off',
            '@typescript-eslint/return-await': [baseBestPracticesRules['no-return-await'], 'in-try-catch'],

            'import/extensions': importExtensionsRule,
            'import/no-extraneous-dependencies': importNoExtraneousDependenciesRule,
        },
    },
    {
        files: tsFiles,
        rules: {
            // Already checked (more thoroughly) by the TypeScript compiler.
            'constructor-super': 'off',
            'getter-return': 'off',
            'no-const-assign': 'off',
            'no-dupe-class-members': 'off',
            'no-dupe-keys': 'off',
            'no-func-assign': 'off',
            'no-import-assign': 'off',
            'no-new-symbol': 'off',
            'no-obj-calls': 'off',
            'no-redeclare': 'off',
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
        },
    },
]);

export default config;
