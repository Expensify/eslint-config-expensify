import {defineConfig} from 'eslint/config';
import es from 'eslint-plugin-es';
import babelParser from '@babel/eslint-parser';

import bestPractices from './best-practices.js';
import errors from './errors.js';
import es6 from './es6.js';
import imports from './imports.js';
import strict from './strict.js';
import style from './style.js';
import unicorn from './unicorn.js';
import variables from './variables.js';

const config = defineConfig([
    ...bestPractices,
    ...errors,
    ...es6,
    ...imports,
    ...strict,
    ...style,
    ...unicorn,
    ...variables,
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
