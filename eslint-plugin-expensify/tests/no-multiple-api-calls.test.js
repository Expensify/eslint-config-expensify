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
                    API.write('Report_AddComment', params);
                }
            `,
        },
        {
            code: `
                function test() {
                    DeprecatedAPI.CreateLogin(params);
                }
            `,
        },
    ],
    invalid: [
        {
            code: `
                function test() {
                    API.CreateLogin(params).then(res => API.write('PreferredLocale_Update', params2));
                }
            `,
            errors: [{
                message,
            }],
        },
    ],
});
