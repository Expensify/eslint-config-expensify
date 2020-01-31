module.exports = {
    plugins: ['react', 'jsx-a11y'],
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
        ecmaVersion: 2018,
        sourceType: 'module',
        ecmaFeatures: {
            generators: true,
            objectLiteralDuplicateProperties: true
        }
    }
};
