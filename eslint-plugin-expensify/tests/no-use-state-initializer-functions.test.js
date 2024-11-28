const RuleTester = require('eslint').RuleTester;
const rule = require('../no-use-state-initializer-functions');
const message = require('../CONST').MESSAGE.NO_USE_STATE_INITIALIZER_CALL_FUNCTION;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-use-state-initializer-functions', rule, {
    valid: [
        {
            // Calling a callback should be valid
            code: `
                useState(() => testFunc());
            `,
        },
    ],
    invalid: [
        {
            // Calling a function should be invalid
            code: `
                useState(testFunc());
            `,
            errors: [
                {
                    message,
                },
            ],
        },
    ],
});
