const RuleTester = require('@typescript-eslint/rule-tester').RuleTester;
const rule = require('../prefer-locale-compare-from-context');
const message = require('../CONST').MESSAGE.PREFER_LOCALE_COMPARE_FROM_CONTEXT;

const ruleTester = new RuleTester({
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 2020,
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
            filename: '../tests/file.ts',
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
