import {RuleTester} from 'eslint';
import * as rule from '../prefer-early-return.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.PREFER_EARLY_RETURN;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('prefer-early-return', rule, {
    valid: [
        {
            code: `
                function test() {
                    if (someCondition) {
                        return true;
                    }

                    return false;
                }`,
        },

    ],
    invalid: [
        {
            code: `
                function test() {
                    if (someCondition) {
                        return false;
                    }
                }
            `,
            errors: [{
                message,
            }],
        },
    ],
});
