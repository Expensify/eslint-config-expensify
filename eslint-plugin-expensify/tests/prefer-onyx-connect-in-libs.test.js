const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-onyx-connect-in-libs');
const message = require('../CONST').MESSAGE.PREFER_ONYX_CONNECT_IN_LIBS;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

const example = `
Onyx.connect({
    key: ONYXKEYS.KEY_NAME,
    callback: () => {},
});
`;

ruleTester.run('prefer-onyx-connect-in-libs', rule, {
    valid: [
        {
            code: example,

            // Mock filename - it's acceptable to use Onyx.connect() in an action file only
            filename: './src/libs/actions/Test.js',
        },
    ],
    invalid: [
        {
            code: example,
            errors: [{
                message,
            }],
            filename: './src/components/Test.js',
        },
        {
            code: example,
            errors: [{
                message,
            }],
            filename: './src/pages/report/Test.js',
        },
    ],
});
