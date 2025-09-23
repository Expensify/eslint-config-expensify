const RuleTester = require('eslint').RuleTester;
const rule = require('../use-periods-for-error-messages');
const message = require('../CONST').MESSAGE.USE_PERIODS_ERROR_MESSAGES;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

const goodExampleSingleSentence = `
const err = new Error('This is a test message'); 
`;

const goodExampleMultipleSentences = `
const err = new Error('This is a test message. Last period is mandatory.');
`;

const goodExampleSingleSentenceWithVar = `
const errorMessage = 'This is a test message';
const err = new Error(errorMessage);
`;

const goodExampleMultipleSentencesWithVar = `
const errorMessage = 'This is a test message. Last period is mandatory.';
const err = new Error(errorMessage);
`;

const badExampleSingleSentence = `
const err = new Error('This is a test message.');
`;

const badExampleSingleSentenceWithVar = `
const errorMessage = 'This is a test message.';
const err = new Error(errorMessage);
`;

const badExampleMultipleSentences = `
const err = new Error('This is a test message. Last period is mandatory');
`;

const badExampleMultipleSentencesWithVar = `
const errorMessage = 'This is a test message. Last period is mandatory';
const err = new Error(errorMessage);
`;

ruleTester.run('use-periods-for-error-messages', rule, {
    valid: [
        {
            code: goodExampleSingleSentence,
        },
        {
            code: goodExampleMultipleSentences,
        },
        {
            code: goodExampleSingleSentenceWithVar,
        },
        {
            code: goodExampleMultipleSentencesWithVar,
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
            code: badExampleSingleSentenceWithVar,
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
        {
            code: badExampleMultipleSentencesWithVar,
            errors: [{
                message,
            }],
        },
    ],
});
