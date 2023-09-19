const RuleTester = require('eslint').RuleTester;
const rule = require('../no-multiple-onyx-in-file');
const message = require('../CONST').MESSAGE.NO_MULTIPLE_ONYX_IN_FILE;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-multiple-onyx-in-file', rule, {
    valid: [
        {
            code: `
                compose(
                    withOnyx({
                        key: 'value',
                    })
                )(Component);
            `,
        },
    ],
    invalid: [
        {
            code: `
                compose(
                    withOnyx({
                        key1: 'value1',
                    }),
                    withOnyx({
                        key1: 'value1',
                    })
                )(Component);
            `,
            errors: [
                {
                    message,
                },
            ],
        },
    ],
});
