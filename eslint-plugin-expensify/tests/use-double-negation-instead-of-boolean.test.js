const RuleTester = require('eslint').RuleTester;
const rule = require('../use-double-negation-instead-of-boolean');
const message = require('../CONST').MESSAGE.USE_DOUBLE_NEGATION_INSTEAD_OF_BOOLEAN;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('use-double-negation-instead-of-Boolean()', rule, {
    valid: [
        {
            code: '!!test',
        },
        {
            code: '!!(test1 || test2)',
        },
        {
            code: '!!(test1 && test2)',
        },
        {
            code: '!!(test1 && (test2 || test3))',
        },
        {
            code: '!!(test1 || test2 && test3)',
        },
        {
            code: '!!test ? "" : "example"',
        },
    ],
    invalid: [
        {
            code: 'Boolean(test)',
            output: '!!test',
            errors: [{
                message,
            }],
        },
        {
            code: 'Boolean(test1 || test2)',
            output: '!!(test1 || test2)',
            errors: [{
                message,
            }],
        },
        {
            code: 'Boolean(test1 && test2)',
            output: '!!(test1 && test2)',
            errors: [{
                message,
            }],
        },
        {
            code: 'Boolean(test1 && (test2 || test3))',
            output: '!!(test1 && (test2 || test3))',
            errors: [{
                message,
            }],
        },
        {
            code: 'Boolean(test1 || test2 && test3)',
            output: '!!(test1 || test2 && test3)',
            errors: [{
                message,
            }],
        },
        {
            code: 'Boolean(test) ? "" : "example"',
            output: '!!test ? "" : "example"',
            errors: [{
                message,
            }],
        },
    ],
});
