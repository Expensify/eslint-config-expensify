import {RuleTester} from 'eslint';
import {fileURLToPath} from 'url';
import parser from '@typescript-eslint/parser';
import path from 'path';
import * as rule from '../prefer-locale-compare-from-context.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.PREFER_LOCALE_COMPARE_FROM_CONTEXT;

const dirname = path.dirname(fileURLToPath(import.meta.url));
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

const fileTs = path.join(tsconfigRootDir, 'file.ts');
const testFilePath = path.join(tsconfigRootDir, 'tests', 'file.ts');

ruleTester.run('prefer-locale-compare-from-context', rule, {
    valid: [
        {
            filename: fileTs,
            code: `
                const localeCompare = (a, b) => {};
                const result = localeCompare(a, b);
            `,
        },
        {
            filename: fileTs,
            code: `
                const notAString = {};
                const result = notAString.localeCompare('xyz');
            `,
        },

        // Test files should be ignored
        {
            filename: testFilePath,
            code: `
                const str = 'abc';
                const result = str.localeCompare('xyz');
            `,
        },
    ],
    invalid: [
        {
            filename: fileTs,
            code: `
                const str = 'abc';
                const result = str.localeCompare('xyz');
            `,
            errors: [{message}],
        },
        {
            filename: fileTs,
            code: `
                const getString = () => 'abc';
                const result = getString().localeCompare('xyz');
            `,
            errors: [{message}],
        },
        {
            filename: fileTs,
            code: `
                'abc'.localeCompare('xyz');
            `,
            errors: [{message}],
        },
    ],
});
