module.exports = {
    rules: {
        'prefer-template': 'error',

        // Rather then blindly enforcing destructuring assignments, we'll trust the author's best judgement on when
        // to make use of them, and when not; see https://github.com/Expensify/Style-Guide/pull/60 for more details
        'prefer-destructuring': 'off',

        // By default, this rules makes us use both "for" attributes and nest inputs inside of
        // labels. We would rather just do either since browsers don't have a preference.
        'jsx-a11y/label-has-associated-control': ['error', {
            assert: 'either',
        }],

        // Only require parens around arrow function arguments when there is a block body
        'arrow-parens': ['error', 'as-needed', {
            requireForBlockBody: true
        }],
    }
};
