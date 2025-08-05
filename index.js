const path = require('path');
const rulesDirPlugin = require('eslint-plugin-rulesdir');

rulesDirPlugin.RULES_DIR = path.resolve(__dirname, 'eslint-plugin-expensify');

module.exports = {
    plugins: ['@lwc/eslint-plugin-lwc', 'eslint-plugin-es', 'rulesdir', 'react', 'react-hooks', 'import', 'jsx-a11y'],
    extends: [
        // All Airbnb rules are now inlined into these files
        require.resolve('./rules/style'),
        require.resolve('./rules/es6'),
        require.resolve('./rules/react'),
        'plugin:react-hooks/recommended',
        require.resolve('./rules/expensify'),
    ],
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js', '.jsx', '.json'],
            },
        },
        react: {
            pragma: 'React',
            version: 'detect',
        },
        propWrapperFunctions: [
            'forbidExtraProps', // https://www.npmjs.com/package/airbnb-prop-types
            'exact', // https://www.npmjs.com/package/prop-types-exact
            'Object.freeze', // https://tc39.github.io/ecma262/#sec-object.freeze
        ],
    },
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
