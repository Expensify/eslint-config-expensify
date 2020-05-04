module.exports = {
    rules: {
        // Do not prevent multiple component definition per file
        'react/no-multi-comp': 'off',

        // Do not prevent missing React when using JSX
        'react/react-in-jsx-scope': 'off',

        // Enforce indentation of 4 spaces
        'react/jsx-indent-props': ['error', 4],
        'react/jsx-indent': ['error', 4],
        'react/jsx-no-undef': ['error', {
            allowGlobals: true
        }],
        'react/prefer-es6-class': 'warn',
        'react/prefer-stateless-function': 'warn',
        'react/prop-types': 'warn',

        // findDOMNode() will be an error, use refs instead
        'react/no-find-dom-node': 'warn',

        // This will only be a warning, to promote us to write better propTypes
        'react/forbid-prop-types': 'warn',

        // This is also a warning as its a best practice to not use strings, but its not being deprecated either
        'react/no-string-refs': 'warn',

        // Rather then blindly enforcing destructuring assignments, we'll trust the author's best judgement on when
        // to make use of them, and when not; see https://github.com/Expensify/Style-Guide/pull/60 for more details
        'react/destructuring-assignment': 'off',

        // We want to force the use of stateless functions when we can
        'react/prefer-stateless-function': 'error',

        // New versions of react are removing some methods, and those methods have been prefixed with "UNSAFE_" for now.
        // We need to prevent more usages of these methods and their aliases from being added
        'react/no-unsafe': ['error', {
            checkAliases: true
        }]
    }
};
