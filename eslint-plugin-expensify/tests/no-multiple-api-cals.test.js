const RuleTester = require('eslint').RuleTester;
const rule = require('../no-api-in-views');
const message = require('../CONST').MESSAGE.NO_MULTIPLE_API_CALLS;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-multiple-api-calls', rule, {
    valid: [
        {
            code: `
                function test() {
                    API.call(params);
                }
            `,

            // Mock filename - it's acceptable to use API in an action file, but not component
            filename: './src/libs/actions/Test.js',
        },
        {
            code: `
                function test() {
                    deprecatedAPI.call(params);
                }
            `,
            filename: './src/libs/actions/Test.js',
        },
    ],
    invalid: [
        {
            code: `
                function test() {
                    deprecatedAPI.call(params).then(res => API.call(params2));
                }
            `,
            errors: [{
                message,
            }],
            filename: './src/libs/actions/Test.js',
        },
    ],
});
