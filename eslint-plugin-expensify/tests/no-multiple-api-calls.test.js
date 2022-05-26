const RuleTester = require('eslint').RuleTester;
const rule = require('../no-multiple-api-calls');
const message = require('../CONST').MESSAGE.NO_MULTIPLE_API_CALLS;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

// Mock filename - this rule is scoped to the ./actions/ directory.
const filename = './src/libs/actions/Test.js';

ruleTester.run('no-multiple-api-calls', rule, {
    valid: [
        {
            code: `
                function test() {
                    API.call(params);
                }
            `,
            filename,
        },
        {
            code: `
                function test() {
                    deprecatedAPI.call(params);
                }
            `,
            filename,
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
            filename,
        },
    ],
});
