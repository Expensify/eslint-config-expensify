const RuleTester = require('eslint').RuleTester;
const rule = require('../no-use-state-initializer-functions');
const message = require('../CONST').MESSAGE.NO_USE_STATE_INITIALIZER_CALL_FUNCTION;

const ruleTester = new RuleTester({
    languageOptions: {
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
        {
            // Calling a callback should be valid
            code: `
                useState(() => testFunc().value);
            `,
        },
        {
            // Calling a callback should be valid
            code: `
                useState(condition ? testFunc : testFunc);
            `,
        },
        {
            // Calling a callback should be valid
            code: `
                useState(condition ? () => testFunc() : () => testFunc());
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
        {
            // Calling a function should be invalid
            code: `
                useState(testFunc().value);
            `,
            errors: [
                {
                    message,
                },
            ],
        },
        {
            // Calling a function should be invalid
            code: `
                useState(condition ? testFunc() : testFunc());
            `,
            errors: [
                {
                    message,
                },
            ],
        },
        {
            // Calling a function should be invalid
            code: `
                useState(condition ? (() => testFunc())() : (() => testFunc())());
            `,
            errors: [
                {
                    message,
                },
            ],
        },
    ],
});
