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
            filename: './src/libs/actions/Test.js',
        },
        {
            code: `
                import Action from './src/libs/actions/Action.js'
                function test() {
                    Action.perform(params);
                }
            `,
            filename: './src/libs/actions/Test.js',
        },
        {
            // Test that two functions in one file with different API/action calls are valid
            code: `
                import Action from './src/libs/actions/Action.js'
                function test() {
                    API.write('Report_AddComment', params);
                }
                function test2() {
                    Action.perform(params);
                }
            `,
            filename: './src/libs/actions/Test.js',
        },
        {
            // Make sure that we will not test a file which is not in '/actions/'
            code: `
                import Action from './src/libs/actions/Action.js'
                function test() {
                    API.write('Report_AddComment', params);
                    Action.perform(params);
                }
            `,
            filename: './src/libs/notActions/Test.js',
        },
    ],
    invalid: [
        {
            code: `
                import Action from './src/libs/actions/Action.js'
                function test() {
                    API.write('Report_AddComment', params);
                    Action.perform(params);
                }
            `,
            errors: [{
                message,
            }],
            filename: './src/libs/actions/Test.js',
        },
    ],
});
