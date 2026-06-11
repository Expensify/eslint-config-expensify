import {defineConfig} from 'eslint/config';
import react from 'eslint-plugin-react';

/**
 * JSX formatting rules enforced by ESLint.
 *
 * Opt in via eslint-config-expensify/react-formatting when a repo is not using
 * Prettier or another dedicated formatter.
 */
const config = defineConfig([{
    plugins: {
        react,
    },

    languageOptions: {
        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
        },
    },

    rules: {
        'jsx-quotes': ['error', 'prefer-double'],
        'react/jsx-closing-bracket-location': ['error', 'line-aligned'],
        'react/jsx-closing-tag-location': 'error',
        'react/jsx-curly-brace-presence': ['error', {props: 'never', children: 'never'}],
        'react/jsx-curly-newline': ['error', {
            multiline: 'consistent',
            singleline: 'consistent',
        }],
        'react/jsx-curly-spacing': ['error', 'never', {allowMultiline: true}],
        'react/jsx-equals-spacing': ['error', 'never'],
        'react/jsx-first-prop-new-line': ['error', 'multiline-multiprop'],
        'react/jsx-indent': ['error', 4],
        'react/jsx-indent-props': ['error', 4],
        'react/jsx-max-props-per-line': ['error', {maximum: 1, when: 'multiline'}],
        'react/jsx-one-expression-per-line': ['error', {allow: 'single-child'}],
        'react/jsx-tag-spacing': ['error', {
            closingSlash: 'never',
            beforeSelfClosing: 'always',
            afterOpening: 'never',
            beforeClosing: 'never',
        }],
        'react/jsx-wrap-multilines': ['error', {
            declaration: 'parens-new-line',
            assignment: 'parens-new-line',
            return: 'parens-new-line',
            arrow: 'parens-new-line',
            condition: 'parens-new-line',
            logical: 'parens-new-line',
            prop: 'parens-new-line',
        }],
    },
}]);

export default config;
