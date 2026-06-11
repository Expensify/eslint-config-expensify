import {defineConfig} from 'eslint/config';
import es from 'eslint-plugin-es';
import babelParser from '@babel/eslint-parser';

import bestPractices from '../rules/base/best-practices.js';
import errors from '../rules/base/errors.js';
import styleBase from '../rules/base/style.js';
import variables from '../rules/base/variables.js';
import es6Base from '../rules/base/es6.js';
import imports from '../rules/base/imports.js';
import strictBase from '../rules/base/strict.js';
import es6 from '../rules/es6.js';
import style from '../rules/style.js';
import unicorn from '../rules/unicorn.js';

const config = defineConfig([
    bestPractices,
    errors,
    styleBase,
    variables,
    es6Base,
    imports,
    strictBase,
    es6,
    style,
    unicorn,
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },

        plugins: {
            es,
        },

        languageOptions: {
            parser: babelParser,
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                requireConfigFile: false,
                ecmaFeatures: {
                    generators: true,
                    objectLiteralDuplicateProperties: true,
                },
            },
        },
    },
]);

export default config;
