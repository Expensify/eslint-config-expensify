const RuleTester = require('@typescript-eslint/rule-tester').RuleTester;
const rule = require('../boolean-conditional-rendering');

const ruleTester = new RuleTester({
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 2020,
        ecmaFeatures: {
            jsx: true,
        },
    },
});

ruleTester.run('boolean-conditional-rendering', rule, {
    valid: [
        {
            code: `
                const isActive = true;
                isActive && <MyComponent />;
            `,
        },
        {
            code: `
                const isActive = false;
                isActive && <MyComponent />;
            `,
        },
        {
            code: `
                const isVisible = Boolean(someValue);
                isVisible && <MyComponent />;
            `,
        },
        {
            code: `
                const user = { isLoggedIn: true, isBlocked: false };
                const isAuthorized = user.isLoggedIn && !user.isBlocked;
                isAuthorized && <MyComponent />;
            `,
        },
        {
            code: `
                function isAuthenticated() { return true; }
                isAuthenticated() && <MyComponent />;
            `,
        },
        {
            code: `
                const isReady: boolean = true;
                isReady && <ReadyComponent />;
            `,
        },
        {
            code: `
                const isNotActive = !isActive;
                isNotActive && <MyComponent />;
            `,
        },
        {
            code: `
                const condition = !!someValue;
                condition && <MyComponent />;
            `,
        },
        {
            code: `
                const condition = someValue as boolean;
                condition && <MyComponent />;
            `,
        },
        {
            code: `
                enum Status { Active, Inactive }
                const isActive = status === Status.Active;
                isActive && <MyComponent />;
            `,
        },
        {
            code: `
                const isAvailable = checkAvailability();
                isAvailable && <MyComponent />;
                function checkAvailability(): boolean { return true; }
            `,
        },
    ],
    invalid: [
        {
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
