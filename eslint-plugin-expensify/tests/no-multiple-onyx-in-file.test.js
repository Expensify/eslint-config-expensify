const RuleTester = require('eslint').RuleTester;
const rule = require('../no-multiple-onyx-in-file');
const message = require('../CONST').MESSAGE.NO_MULTIPLE_ONYX_IN_FILE;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-multiple-onyx-details-in-file', rule, {
    valid: [
        {
            code: `
                withOnyx({
                    key1: 'value1',
                })(Component1);

                withOnyx({
                    key1: 'value2',
                })(Component1);

                withOnyx({
                    key2: 'value2',
                })(Component1);

                withOnyx({
                    key2: 'value1',
                })(Component1);
            `,
        },
    ],
    invalid: [
        {
            code: `
                withOnyx({
                    key1: 'value1',
                })(Component1);

                withOnyx({
                    key1: 'value1',
                })(Component1);
            `,
            errors: [
                {
                    message,
                },
            ],
        },
    ],
});

