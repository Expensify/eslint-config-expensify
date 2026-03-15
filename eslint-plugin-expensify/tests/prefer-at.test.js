import {RuleTester} from 'eslint';
import {fileURLToPath} from 'url';
import parser from '@typescript-eslint/parser';
import path from 'path';
import * as rule from '../prefer-at.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.PREFER_AT;

const dirname = path.dirname(fileURLToPath(import.meta.url));
const tsconfigRootDir = path.resolve(dirname, '../fixtures');
const testFile = path.join(tsconfigRootDir, 'test.ts');

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

ruleTester.run('prefer-at', rule, {
    valid: [
        {
            code: 'const example = [1, 2, 3, 4]; example.at(0)',
            filename: testFile,
        },
        {
            filename: testFile,
            code: 'const test = [1, 2, 3, 4]; test.at(1)',
        },
        {
            filename: testFile,
            code: 'const sample = [1, 2, 3, 4]; sample.at(-1)',
        },
        {
            filename: testFile,
            code: 'const testing = [1, 2, 3, 4]; testing.at(-2)',
        },
        {
            filename: testFile,
            code: 'const testing = [[1, 2], [3, 4]]; testing.at(0).at(-1)',
        },
        {
            filename: testFile,
            code: 'const test = [1, 2, 3, 4]; test.at((test.length - 1) / 2)',
        },
        {
            filename: testFile,
            code: `
                const object = {0: 'v0', 1: 'v1', 2: 'v2'};
                object[0]
                `,
        },
        {
            filename: testFile,
            code: `
                const index = 1;
                const object = {0: 'v0', 1: 'v1', 2: 'v2'};
                object[index]
                `,
        },
        {
            filename: testFile,
            code: '[0, 1, 2].at(1)',
        },
        {
            filename: testFile,
            code: 'const a = [1, 2, 3, 4]; a.at(a.length - 1)',
        },
        {
            filename: testFile,
            code: 'const a = [1, 2, 3, 4]; a.at(-2)',
        },
        {
            filename: testFile,
            code: 'const a = [1, 2, 3, 4]; const index = 1; a.at(index)',
        },
        {
            filename: testFile,
            code: 'const obj = { a: 1, b: 2 }; obj["a"]',
        },
        {
            filename: testFile,
            code: 'const mixed = [1, { a: 2 }, 3]; mixed.at(1).a',
        },
        {
            filename: testFile,
            code: 'const a = ["a", "b", "c"] as const; a[0]',
        },
        {
            filename: testFile,
            code: 'const example = [1, 2, 3, 4]; example.map(x => x * 2);',
        },
        {
            filename: testFile,
            code: 'const example = [1, 2, 3, 4]; const x = 1; example[x] = 5;',
        },
    ],
    invalid: [
        {
            filename: testFile,
            code: 'const example = [1, 2, 3, 4]; example[0]',
            output: 'const example = [1, 2, 3, 4]; example.at(0)',
            errors: [{
                message,
            }],
        },
        {
            filename: testFile,
            code: 'const test = [1, 2, 3, 4]; test[1]',
            output: 'const test = [1, 2, 3, 4]; test.at(1)',
            errors: [{
                message,
            }],
        },
        {
            filename: testFile,
            code: 'const test = [1, 2, 3, 4]; test[(test.length - 1) / 2]',
            output: 'const test = [1, 2, 3, 4]; test.at((test.length - 1) / 2)',
            errors: [{
                message,
            }],
        },
        {
            filename: testFile,
            code: `
                const sample = [1, 2, 3, 4];
                sample[sample.length - 1]
                `,
            output: `
                const sample = [1, 2, 3, 4];
                sample.at(sample.length - 1)
                `,
            errors: [{
                message,
            }],
        },
        {
            filename: testFile,
            code: '[0, 1, 2, 3, 4][1]',
            output: '[0, 1, 2, 3, 4].at(1)',
            errors: [{
                message,
            }],
        },
        {
            filename: testFile,
            code: 'const index = 1; const a = [1, 2, 3, 4]; a[index]',
            output: 'const index = 1; const a = [1, 2, 3, 4]; a.at(index)',
            errors: [{
                message,
            }],
        },
        {
            filename: testFile,
            code: 'const a = [1, 2, 3, 4]; a[a.length - 1]',
            output: 'const a = [1, 2, 3, 4]; a.at(a.length - 1)',
            errors: [{
                message,
            }],
        },
    ],
});
