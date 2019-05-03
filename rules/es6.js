module.exports = {
    rules: {
        'prefer-template': 'error',

        // Rather then blindly enforcing destructuring assignments, we'll trust the author's best judgement on when
        // to make use of them, and when not; see https://github.com/Expensify/Style-Guide/pull/60 for more details
        'prefer-destructuring': 'off',
    }
};
