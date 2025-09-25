import {RuleTester} from 'eslint';
import * as rule from '../prefer-import-module-contents.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.PREFER_IMPORT_MODULE_CONTENTS;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('prefer-import-module-contents', rule, {
    valid: [
        {
            code: 'import * as test from \'./test\';',
        },
        {
            code: 'import test from \'./test\';',
        },
        {
            code: 'import test, {withTest} from \'./test\';',
        },
        {
            code: 'import {test} from \'test\';',
        },
        {
            code: 'import \'../assets/css/fonts.css\';',
        },
    ],
    invalid: [
        {
            code: 'import {test} from \'./test\';',
            errors: [{
                message,
            }],
        },
        {
            code: 'import {test} from \'../test\';',
            errors: [{
                message,
            }],
        },
        {
            code: 'import {test, anotherTest} from \'./test\';',
            errors: [{
                message,
            }],
        },
    ],
});
