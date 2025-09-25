import {RuleTester} from 'eslint';
import * as rule from '../no-inline-named-export.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.NO_INLINE_NAMED_EXPORT;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-inline-named-export', rule, {
    valid: [
        {
            code: 'const test = \'derp\'; export {test}',
        },
        {
            code: 'const test = \'derp\'; export default test',
        },
        {
            code: 'export default () => {}',
        },
    ],
    invalid: [
        {
            code: 'export const inlineNamedExport = true;',
            errors: [{
                message,
            }],
        },
        {
            code: 'export function inlineExport() {}',
            errors: [{
                message,
            }],
        },
        {
            code: 'export class Something {}',
            errors: [{
                message,
            }],
        },
    ],
});
