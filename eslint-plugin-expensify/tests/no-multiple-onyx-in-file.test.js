import {RuleTester} from 'eslint';
import * as rule from '../no-multiple-onyx-in-file.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.NO_MULTIPLE_ONYX_IN_FILE;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-multiple-onyx-in-file', rule, {
    valid: [
        {
            code: `
                compose(
                    withOnyx({
                        key: 'value',
                    })
                )(Component);
            `,
        },
    ],
    invalid: [
        {
            code: `
                compose(
                    withOnyx({
                        key1: 'value1',
                    }),
                    withOnyx({
                        key1: 'value1',
                    })
                )(Component);
            `,
            errors: [
                {
                    message,
                },
            ],
        },
    ],
});
