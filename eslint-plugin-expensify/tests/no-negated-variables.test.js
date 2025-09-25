import {RuleTester} from 'eslint';
import * as rule from '../no-negated-variables.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.NO_NEGATED_VARIABLES;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-negated-variables', rule, {
    valid: [
        {
            code: 'const isValid = true;',
        },
        {
            code: 'function isValidName() {}',
        },
        {
            code: 'const notificationSettings = {};',
        },
        {
            code: 'const iPhonesWithNotches = [];',
        },
        {
            code: 'const myNote = []',
        },
        {
            code: 'const isNotification = {};',
        },
        {
            code: 'const notificationIsVisible = false;',
        },
        {
            code: 'const noteNotification = {}',
        },
        {
            code: 'const notificationNote = {}',
        },
        {
            code: 'const notableNotions = [];',
        },
        {
            code: 'const notionsOfNote = [];',
        },
        {
            code: 'const NOTABLE_EXCEPTIONS = [];',
        },
    ],
    invalid: [
        {
            code: 'const isNotValid = true;',
            errors: [{
                message,
            }],
        },
        {
            code: 'function isNotValidName() {}',
            errors: [{
                message,
            }],
        },
        {
            code: 'const isNotEnabled = false;',
            errors: [{
                message,
            }],
        },
        {
            code: 'const isNotChanged = false;',
            errors: [{
                message,
            }],
        },
        {
            code: 'const canNotBeValid = true;',
            errors: [{
                message,
            }],
        },
        {
            code: 'const willNotBeValid = true',
            errors: [{
                message,
            }],
        },
        {
            code: 'const isNotNotification = false;',
            errors: [{
                message,
            }],
        },
        {
            code: 'const notificationNoteIsNotVisible = false;',
            errors: [{
                message,
            }],
        },
        {
            code: 'const notificationsThatAreNotOfNote = [];',
            errors: [{
                message,
            }],
        },
        {
            code: 'const THIS_IS_NOT_GOOD = true;',
            errors: [{
                message,
            }],
        },
    ],
});
