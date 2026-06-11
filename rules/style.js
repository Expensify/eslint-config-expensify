import {defineConfig} from 'eslint/config';
import jsdoc from 'eslint-plugin-jsdoc';

const config = defineConfig([
    {
        plugins: {
            jsdoc,
        },

        rules: {
            camelcase: 'off',
            'class-methods-use-this': 'off',
            'consistent-return': 'off',
            'consistent-this': [1, 'self'],
            curly: ['error', 'all'],
            'no-console': ['error', {allow: ['debug', 'error']}],
            'func-names': 'off',
            'global-require': 'off',
            'import/no-dynamic-require': 'off',
            'import/no-extraneous-dependencies': 'off',
            'import/no-unresolved': 'off',
            'jsx-a11y/click-events-have-key-events': 'off',
            'jsx-a11y/label-has-for': 'off',
            'new-cap': 'off',
            'no-alert': 'off',
            'no-mixed-operators': ['error', {
                groups: [
                    ['+', '-', '*', '/', '%', '**'],
                    ['&', '|', '^', '~', '<<', '>>', '>>>'],
                    ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
                    ['&&', '||'],
                    ['in', 'instanceof'],
                ],
                allowSamePrecedence: false,
            }],
            'no-plusplus': 'off',
            'no-return-assign': 'off',
            strict: ['error', 'never'],
            'vars-on-top': 'off',
        },
    },
    {
        files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
        rules: {
            'jsdoc/require-param': 'error',
            'jsdoc/require-param-type': 'error',
            'jsdoc/check-param-names': 'error',
            'jsdoc/check-tag-names': 'error',
            'jsdoc/check-types': ['error', {
                exemptTagContexts: [
                    {tag: 'param', types: ['Object']},
                    {tag: 'returns', types: ['Object']},
                ],
                noDefaults: true,
            }],
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
        rules: {
            'jsdoc/no-types': 'error',
        },
    },
]);

export default config;
