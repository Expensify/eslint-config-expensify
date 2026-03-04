import {RuleTester} from 'eslint';
import {fileURLToPath} from 'url';
import parser from '@typescript-eslint/parser';
import path from 'path';
import * as rule from '../boolean-conditional-rendering.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const tsconfigRootDir = path.resolve(dirname, '../fixtures');
const testFile = path.join(tsconfigRootDir, 'test.tsx');

const ruleTester = new RuleTester({
    languageOptions: {
        parser,
        parserOptions: {
            project: path.join(tsconfigRootDir, 'tsconfig.boolean-conditional.json'),
            tsconfigRootDir,
            sourceType: 'module',
            ecmaVersion: 2020,
            ecmaFeatures: {
                jsx: true,
            },
        },
    },
});

ruleTester.run('boolean-conditional-rendering', rule, {
        valid: [
        {
            filename: testFile,
            code: `
                const isActive = true;
                isActive && <MyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                const isActive = false;
                isActive && <MyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                const isVisible = Boolean(someValue);
                isVisible && <MyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                const user = { isLoggedIn: true, isBlocked: false };
                const isAuthorized = user.isLoggedIn && !user.isBlocked;
                isAuthorized && <MyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                function isAuthenticated() { return true; }
                isAuthenticated() && <MyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                const isReady: boolean = true;
                isReady && <ReadyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                const isNotActive = !isActive;
                isNotActive && <MyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                const condition = !!someValue;
                condition && <MyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                const condition = someValue as boolean;
                condition && <MyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                enum Status { Active, Inactive }
                const isActive = status === Status.Active;
                isActive && <MyComponent />;
            `,
        },
        {
            filename: testFile,
            code: `
                const isAvailable = checkAvailability();
                isAvailable && <MyComponent />;
                function checkAvailability(): boolean { return true; }
            `,
        },
    ],
    invalid: [
        {
            filename: testFile,
            code: `
                const condition = "string";
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'string'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition = 42;
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'number'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition = [];
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'any[]'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition = {};
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: '{}'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition = null;
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'any'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition = undefined;
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'any'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition = () => {};
                condition() && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'void'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition: unknown = someValue;
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'unknown'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition: boolean | string = someValue;
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'string | boolean'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition = someObject?.property;
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'any'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                enum Status { Active, Inactive }
                const status = Status.Active;
                status && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'string'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition = Promise.resolve(true);
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'Promise<boolean>'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                function getValue() { return "value"; }
                getValue() && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'string'},
                },
            ],
        },
        {
            filename: testFile,
            code: `
                const condition = someValue as string;
                condition && <MyComponent />;
            `,
            errors: [
                {
                    messageId: 'nonBooleanConditional',
                    data: {type: 'string'},
                },
            ],
        },
    ],
});
