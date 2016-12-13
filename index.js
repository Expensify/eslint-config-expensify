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
    rules: {
        // Expensify legacy rules
        //
        // The following rules are actually supposed to be errors but we decided to
        // switch them to warnings to not invalidate our current codebase. We should
        // still try to get rid of these modifications at some point and turn them
        // back in to errors.
        //
        'jsx-a11y/label-has-for': 1
    },
    ecmaFeatures: {
        generators: true,
        objectLiteralDuplicateProperties: true,
        experimentalObjectRestSpread: true
    }
};
