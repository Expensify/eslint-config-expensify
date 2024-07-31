const RuleTester = require('eslint').RuleTester;
const rule = require('../use-periods-for-error-messages');
const message = require('../CONST').MESSAGE.USE_PERIODS_ERROR_MESSAGES;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

const goodExampleSingleSentence = `
error: {
    testMessage: 'This is a test message'
}
`;

const goodExampleMultipleSentences = `
error: {
    testMessage: 'This is a test message. Last period is mandatory.'
}
`;

const badExampleSingleSentence = `
error: {
    testMessage: 'This is a test message.'
}
`;

const badExampleMultipleSentences = `
error: {
    testMessage: 'This is a test message. Last period is mandatory'
}
`;

ruleTester.run('use-periods-for-error-messages', rule, {
    valid: [
        {
            code: goodExampleSingleSentence,
        },
        {
            code: goodExampleMultipleSentences,
        },
    ],
    invalid: [
        {
            code: badExampleSingleSentence,
            errors: [{
                message,
            }],
        },
        {
            code: badExampleMultipleSentences,
            errors: [{
                message,
            }],
        },
    ],
});
