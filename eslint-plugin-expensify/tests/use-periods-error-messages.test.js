const RuleTester = require('eslint').RuleTester;
const rule = require('../use-periods-for-error-messages');
const message = require('../CONST').MESSAGE.USE_PERIODS_ERROR_MESSAGES;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

const goodExample = `
error: {
    testMessage: 'This is a test message.'
}
`;

const badExample = `
error: {
    testMessage: 'This is a test message'
}
`;

ruleTester.run('use-periods-for-error-messages', rule, {
    valid: [
        {
            code: goodExample,
        },
    ],
    invalid: [
        {
            code: badExample,
            errors: [{
                message,
            }],
        },
    ],
});
