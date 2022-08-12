const RuleTester = require('eslint').RuleTester;
const rule = require('../display-name-property');
const {DISPLAY_NAME_PROPERTY_CLASS, DISPLAY_NAME_PROPERTY_FUNCTION} = require('../CONST').MESSAGE;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('display-name-property', rule, {
    valid: [
        {
            code: `
                const Test = () => null;
                Test.displayName = 'Test';
            `,
            filename: './src/components/Test.js',
        },
        {
            code: `
                class Test extends Component {
                    render() {
                        return null;
                    }
                }
            `,
            filename: './src/components/Test.js',
        },
        {
            code: `
                const Test = () => null;
                Test.displayName = 'Test';
            `,
            filename: './src/components/Test/index.js',
        },
        {
            code: `
                class Test extends Component {
                    render() {
                        return null;
                    }
                }
            `,
            filename: './src/components/Test/index.js',
        },
    ],
    invalid: [
        {
            code: `
                const Test = () => null;
            `,
            filename: './src/components/Test.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_FUNCTION,
            }],
        },
        {
            code: `
                class Test extends Component {
                    render() {
                        return null;
                    }
                }
                Test.displayName = 'Test';
            `,
            filename: './src/components/Test.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_CLASS,
            }],
        },
        {
            code: `
                const Test = () => null;
            `,
            filename: './src/components/Test/index.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_FUNCTION,
            }],
        },
        {
            code: `
                class Test extends Component {
                    render() {
                        return null;
                    }
                }
                Test.displayName = 'Test';
            `,
            filename: './src/components/Test/index.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_CLASS,
            }],
        },
    ],
});
