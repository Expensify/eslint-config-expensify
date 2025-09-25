import {RuleTester} from 'eslint';
import * as rule from '../prefer-str-method.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.PREFER_STR_METHOD;

const ruleTester = new RuleTester({
    languageOptions: {
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
