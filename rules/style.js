module.exports = {
    rules: {
        camelcase: 'off',
        'class-methods-use-this': 'off',
        'comma-dangle': 'off',
        'consistent-return': 'off',
        'consistent-this': [1, 'self'],
        'func-names': 'off',
        'global-require': 'off',
        'import/no-dynamic-require': 'off',
        'import/no-extraneous-dependencies': 'off',
        'import/no-unresolved': 'off',
        // Enforce indentation of 4 spaces
        indent: ['error', 4],
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
