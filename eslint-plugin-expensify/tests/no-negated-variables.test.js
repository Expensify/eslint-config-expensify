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
        {
            code: 'const shouldShowNotFoundPage = true;',
        },
        {
            code: 'function ReportNotFoundGuard() {}',
        },
        {
            code: 'const IOURequestStepTaxRatePageWithWritableReportOrNotFound = withWritableReportOrNotFound(IOURequestStepTaxRatePage);',
        },
        {
            code: 'const IS_NOT_FOUND = true;',
        },
        {
            code: 'const isReportNotFound = () => false;',
        },
        {
            code: 'const memberNotFoundMessage = "";',
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
        {
            code: 'const participantNotSelected = {};',
            errors: [{
                message,
            }],
        },
        {
            code: 'const cannotBeFlagged = true;',
            errors: [{
                message,
            }],
        },
        {
            code: 'const isNotFoundation = true;',
            errors: [{
                message,
            }],
        },
        {
            code: 'const NOT_FOUNDATION = true;',
            errors: [{
                message,
            }],
        },
        {
            code: 'const isTripNotInitialized = false;',
            errors: [{
                message,
            }],
        },
    ],
});
