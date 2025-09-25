
import {RuleTester} from 'eslint';
import * as rule from '../no-onyx-connect.js';

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-onyx-connect', rule, {
    valid: [
        {
            code: 'Onyx.set("key", value);',
        },
        {
            code: 'Onyx.merge("key", value);',
        },
        {
            code: 'useOnyx("key");',
        },
        {
            code: 'const data = connect();',
        },
        {
            code: 'SomeOtherObject.connect();',
        },
        {
            // Test files should be ignored
            code: 'Onyx.connect({key: "test"});',
            filename: '/src/tests/SomeTest.js',
        },
    ],
    invalid: [
        {
            code: 'Onyx.connect({key: "test"});',
            errors: [
                {
                    message: 'Onyx.connect() is deprecated. Use useOnyx() hook instead and pass the data as parameters to a pure function.',
                },
            ],
        },
        {
            code: `
                const connection = Onyx.connect({
                    key: 'someKey',
                    callback: (data) => console.log(data),
                });
            `,
            errors: [
                {
                    message: 'Onyx.connect() is deprecated. Use useOnyx() hook instead and pass the data as parameters to a pure function.',
                },
            ],
        },
        {
            code: `
                function myFunction() {
                    return Onyx.connect({
                        key: 'someKey',
                        initWithStoredValues: false,
                    });
                }
            `,
            errors: [
                {
                    message: 'Onyx.connect() is deprecated. Use useOnyx() hook instead and pass the data as parameters to a pure function.',
                },
            ],
        },
    ],
});
