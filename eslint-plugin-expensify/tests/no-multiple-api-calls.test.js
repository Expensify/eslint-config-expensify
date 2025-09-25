import {RuleTester} from 'eslint';
import * as rule from '../no-multiple-api-calls.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.NO_MULTIPLE_API_CALLS;

const ruleTester = new RuleTester({
    languageOptions: {
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
