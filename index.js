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
    ecmaFeatures: {
        generators: true,
        objectLiteralDuplicateProperties: true,
        experimentalObjectRestSpread: true
    }
};
