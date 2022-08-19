const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-localization');
const message = require('../CONST').MESSAGE.PREFER_LOCALIZATION;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

const validCode = `
const object = {
    [DateUtils.getMicroseconds()]: Localize.translateLocal('i18n.key'),
}
`;

const invalidCode = `
const object = {
    [DateUtils.getMicroseconds()]: 'This is the message',
}
`;

ruleTester.run('prefer-localization', rule, {
    valid: [
        {
            code: validCode,

            // This test is applied only for files inside actions folder
            filename: './src/libs/actions/Test.js',
        },
    ],
    invalid: [
        {
            code: invalidCode,
            errors: [{
                message,
            }],
            filename: './src/libs/actions/Test.js',
        },
    ],
});
