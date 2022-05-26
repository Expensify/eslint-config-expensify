const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-str-method');
const message = require('../CONST').MESSAGE.PREFER_STR_METHOD;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('prefer-str-method', rule, {
    valid: [
        {
            code: 'const testString = "test"; const test = Str.replaceAll(testString, "t", "b")',
        },

        // Valid native string methods
        {
            code: 'const testString = "test"; const test = testString.trim();',
        },
        {
            code: 'const testString = "test"; const test = testString.toUpperCase();',
        },
    ],
    invalid: [
        {
            code: 'const testString = "test"; const test = testString.replaceAll("t", "b");',
            errors: [{
                message: message.replace('{{method}}', 'replaceAll'),
            }],
        },
    ],
});
