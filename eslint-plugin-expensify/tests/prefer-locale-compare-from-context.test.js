import {RuleTester} from '@typescript-eslint/rule-tester';
import {fileURLToPath} from 'url';
import parser from '@typescript-eslint/parser';
import path from 'path';
import * as rule from '../prefer-locale-compare-from-context.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.PREFER_LOCALE_COMPARE_FROM_CONTEXT;

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const tsconfigRootDir = path.resolve(dirname, '../fixtures');

const ruleTester = new RuleTester({
    languageOptions: {
        parser,
        parserOptions: {
            project: './tsconfig.json',
            tsconfigRootDir,
            sourceType: 'module',
            ecmaVersion: 2020,
        },
    },
});

ruleTester.run('prefer-locale-compare-from-context', rule, {
    valid: [
        {
            code: `
                const localeCompare = (a, b) => {};
                const result = localeCompare(a, b);
            `,
            filename: 'file.ts',
        },
        {
            code: `
                const notAString = {};
                const result = notAString.localeCompare('xyz');
            `,
            filename: 'file.ts',
        },

        // Test files should be ignored
        {
            code: `
                const str = 'abc';
                const result = str.localeCompare('xyz');
            `,
            filename: 'tests/file.ts',
        },
    ],
    invalid: [
        {
            code: `
                const str = 'abc';
                const result = str.localeCompare('xyz');
            `,
            errors: [{message}],
            filename: 'file.ts',
        },
        {
            code: `
                const getString = () => 'abc';
                const result = getString().localeCompare('xyz');
            `,
            errors: [{message}],
            filename: 'file.ts',
        },
        {
            code: `
                'abc'.localeCompare('xyz');
            `,
            errors: [{message}],
            filename: 'file.ts',
        },
    ],
});
