const RuleTester = require('eslint').RuleTester;
const rule = require('../no-multiple-api-calls');
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
        },
        {
            code: `
                function test() {
                    deprecatedAPI.call(params);
                }
            `,
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
        },
    ],
});
