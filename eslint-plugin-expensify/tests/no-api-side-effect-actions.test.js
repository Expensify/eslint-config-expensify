const RuleTester = require('eslint').RuleTester;
const rule = require('../no-api-side-effect-actions');
const message = require('../CONST').MESSAGE.NO_API_SIDE_EFFECTS_ACTIONS;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-api-side-effect-actions', rule, {
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
                import Action from './src/libs/actions/Action.js'
                function test() {
                    Action.perform(params);
                }
            `,
        },
    ],
    invalid: [
        {
            code: `
                function test() {
                    DeprecatedAPI.CreateLogin(params).then(res => API.write('PreferredLocale_Update', params2));
                }
            `,
            errors: [{
                message,
            }],
        },
    ],
});
