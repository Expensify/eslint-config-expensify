module.exports = {
    extends: [
        'airbnb',
        require.resolve('./rules/style'),
        require.resolve('./rules/es6'),
        require.resolve('./rules/react')
    ],
    env: {
        browser: true,
        es6: true,
        jquery: true,
        node: true
    },
    parserOptions: {
        ecmaVersion: 2017,
        sourceType: 'module',
        ecmaFeatures: {
            generators: true,
            objectLiteralDuplicateProperties: true,
            experimentalObjectRestSpread: true
        }
    }
};
