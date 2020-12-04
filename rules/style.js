module.exports = {
    rules: {
        camelcase: 'off',
        'class-methods-use-this': 'off',
        'comma-dangle': 'off',
        'consistent-return': 'off',
        'consistent-this': [1, 'self'],
        curly: ['error', 'all'],
        'no-console': ['error', { allow: ['debug', 'error'] }],
        'func-names': 'off',
        'global-require': 'off',
        'import/no-dynamic-require': 'off',
        'import/no-extraneous-dependencies': 'off',
        'import/no-unresolved': 'off',
        'jsx-a11y/click-events-have-key-events': 'off',
        'jsx-a11y/label-has-for': 'off',

        // Enforce indentation of 4 spaces; the third option parameter was copied from Airbnb:
        // https://github.com/airbnb/javascript/blob/60b96d322277c4c71a21a05caba8eb3320e0e3fa/packages/eslint-config-airbnb-base/rules/style.js#L120-L145
        indent: ['error', 4, {
            SwitchCase: 1,
            VariableDeclarator: 1,
            outerIIFEBody: 1,
            FunctionDeclaration: {
                parameters: 1,
                body: 1
            },
            FunctionExpression: {
                parameters: 1,
                body: 1
            },
            CallExpression: {
                arguments: 1
            },
            ArrayExpression: 1,
            ObjectExpression: 1,
            ImportDeclaration: 1,
            flatTernaryExpressions: false,

            // list derived from https://github.com/benjamn/ast-types/blob/HEAD/def/jsx.js
            ignoredNodes: ['JSXElement', 'JSXElement > *', 'JSXAttribute', 'JSXIdentifier', 'JSXNamespacedName', 'JSXMemberExpression', 'JSXSpreadAttribute', 'JSXExpressionContainer', 'JSXOpeningElement', 'JSXClosingElement', 'JSXText', 'JSXEmptyExpression', 'JSXSpreadChild'],
            ignoreComments: false
        }],

        // Airbnb didn't want this rule to be enabled even though it complies with their styleguide - so we're adding it
        // https://github.com/airbnb/javascript/pull/1994
        'lines-around-comment': ['error', {
            beforeLineComment: true,
            allowBlockStart: true,
            allowObjectStart: true,
            allowArrayStart: true,
            allowClassStart: true,
        }],
        'max-len': ['warn', {
            code: 120
        }],
        'new-cap': 'off',
        'no-alert': 'off',
        'no-mixed-operators': ['warn', {
            groups: [
                ['+', '-', '*', '/', '%', '**'],
                ['&', '|', '^', '~', '<<', '>>', '>>>'],
                ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
                ['&&', '||'],
                ['in', 'instanceof']
            ],
            allowSamePrecedence: false
        }],
        'no-plusplus': 'off',
        'no-return-assign': 'off',
        'no-use-before-define': 'warn',
        'object-curly-spacing': ['error', 'never'],

        // Require space before function opening parenthesis
        'space-before-function-paren': ['error', {
            anonymous: 'always',
            named: 'never'
        }],
        strict: ['error', 'never'],
        'valid-jsdoc': ['error', {
            requireParamDescription: false,
            requireReturnDescription: false,
            requireReturn: false
        }],
        'vars-on-top': 'off',

        // This enforces wrapping always the function expression.
        'wrap-iife': ['error', 'inside']
    }
};
