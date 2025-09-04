const path = require('path');
const rulesDirPlugin = require('eslint-plugin-rulesdir');

rulesDirPlugin.RULES_DIR = path.resolve(__dirname, 'eslint-plugin-expensify');

module.exports = {
    plugins: ['@lwc/eslint-plugin-lwc', 'eslint-plugin-es', 'rulesdir'],
    extends: [
        require.resolve('./rules/base/best-practices'),
        require.resolve('./rules/base/errors'),
        require.resolve('./rules/base/node'),
        require.resolve('./rules/base/style'),
        require.resolve('./rules/base/variables'),
        require.resolve('./rules/base/es6'),
        require.resolve('./rules/base/imports'),
        require.resolve('./rules/base/strict'),
        require.resolve('./rules/style'),
        require.resolve('./rules/es6'),
        require.resolve('./rules/react'),
        require.resolve('./rules/react-a11y'),
        'plugin:react-hooks/recommended',
        require.resolve('./rules/expensify'),
    ],
    env: {
        browser: true,
        es6: true,
        jquery: true,
        node: true,
    },
    parser: '@babel/eslint-parser',
    parserOptions: {
        requireConfigFile: false,
        ecmaVersion: 2018,
        sourceType: 'module',
        ecmaFeatures: {
            generators: true,
            objectLiteralDuplicateProperties: true,
        },
    },
};
