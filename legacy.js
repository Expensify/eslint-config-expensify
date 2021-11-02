module.exports = {
    extends: [
        'airbnb-base/legacy',
        require.resolve('./rules/style'),
    ],
    env: {
        browser: true,
        jquery: true,
    },
    rules: {
        'no-param-reassign': 'warn',
        'no-underscore-dangle': 'warn',
        'no-unused-vars': 'warn',
    },
};
