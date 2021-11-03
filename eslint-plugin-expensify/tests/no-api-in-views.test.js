const RuleTester = require('eslint').RuleTester;
const rule = require('../no-api-in-views');
const message = require('../CONST').MESSAGE.NO_API_IN_VIEWS;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

const example = 'API.signIn();';

ruleTester.run('no-api-in-views', rule, {
    valid: [
        {
            code: example,

            // Mock filename - it's acceptable to use API in an action file, but not component
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
    ],
});
