import {RuleTester} from 'eslint';
import * as rule from '../no-api-side-effects-method.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.NO_API_SIDE_EFFECTS_METHOD;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
});

ruleTester.run('no-api-side-effects-method', rule, {
    valid: [
        {
            // Calling another method than makeRequestWithSideEffects should be valid
            code: `
                function test() {
                    API.write('Report_AddComment', params);
                }
            `,
        },
        {code: 'makeRequestWithSideEffects();'},
        {code: 'API["makeRequestWithSideEffects"]();'},
    ],
    invalid: [
        {
            // Calling makeRequestWithSideEffects should be invalid
            code: `
                function test() {
                    API.makeRequestWithSideEffects('Report_AddComment', params);
                }
            `,
            errors: [{
                message,
            }],
        },
        {code: 'API?.makeRequestWithSideEffects();', errors: [{message}]},
    ],
});
