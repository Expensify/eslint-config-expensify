const RuleTester = require('eslint').RuleTester;
const rule = require('../no-call-actions-from-actions');
const message = require('../CONST').MESSAGE.NO_CALL_ACTIONS_FROM_ACTIONS;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-call-actions-from-actions', rule, {
    valid: [
        {
            // Making one API call should be valid
            code: `
                function test() {
                    API.write('Report_AddComment', params);
                }
            `,
            filename: './src/libs/actions/Test.js',
        },
        {
            // Calling DeprecatedAPI should be valid as we focus on rewriting the new API using this best practice
            code: `
                function test() {
                    DeprecatedAPI.read('Report_AddComment', params).then((value) => {
                        Action(params);
                    });
                }
            `,
            filename: './src/libs/actions/Test.js',
        },
        {
            // Having two functions in one file, each with one API or Action call should be valid
            code: `
                import Action from './src/libs/actions/Action.js'
                function test() {
                    API.write('Report_AddComment', params);
                }
                function test2() {
                    Action(params);
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
                    Action(params);
                }
            `,
            filename: './src/libs/notActions/Test.js',
        },
    ],
    invalid: [
        {
            // Making an API call and calling an Action should be invalid
            code: `
                import Action from './src/libs/actions/Action.js'
                function test() {
                    API.write('Report_AddComment', params);
                    Action(params);
                }
            `,
            errors: [{
                message,
            }],
            filename: './src/libs/actions/Test.js',
        },
        {
            // Make sure chaining the API/Action calls is also invalid
            code: `
                import Action from './src/libs/actions/Action.js'
                function test() {
                    API.read('Report_AddComment', params).then((value) => {
                        Action(params);
                    });
                }
            `,
            errors: [{
                message,
            }],
            filename: './src/libs/actions/Test.js',
        },
    ],
});
