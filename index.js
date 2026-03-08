import {defineConfig} from 'eslint/config';
import expensifyPlugin from './eslint-plugin-expensify/index.js';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';

import bestPractices from './rules/base/best-practices.js';
import errors from './rules/base/errors.js';
import node from './rules/base/node.js';
import styleBase from './rules/base/style.js';
import variables from './rules/base/variables.js';
import es6Base from './rules/base/es6.js';
import imports from './rules/base/imports.js';
import strictBase from './rules/base/strict.js';
import react from './rules/react.js';
import reactHooks from './rules/react-hooks.js';
import reactA11y from './rules/react-a11y.js';
import es6 from './rules/es6.js';
import style from './rules/style.js';
import expensify from './rules/expensify.js';
import unicorn from './rules/unicorn.js';

const config = defineConfig([
    bestPractices,
    errors,
    node,
    styleBase,
    variables,
    es6Base,
    imports,
    strictBase,
    react,
    reactA11y,
    es6,
    style,
    reactHooks,
    expensify,
    unicorn,
    {
        plugins: {
            expensify: expensifyPlugin,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jquery,
                ...globals.node,
            },
            parser: babelParser,
            ecmaVersion: 2018,
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
