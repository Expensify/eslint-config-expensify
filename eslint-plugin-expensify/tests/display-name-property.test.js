const RuleTester = require('eslint').RuleTester;
const rule = require('../display-name-property');
const {DISPLAY_NAME_PROPERTY_CLASS, DISPLAY_NAME_PROPERTY_FUNCTION} = require('../CONST').MESSAGE;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

const functionalComponentWithDisplayName = `
    const Test = () => null;
    Test.displayName = 'Test';
`;

const classComponentWithoutDisplayName = `
    class Test extends Component {
        render() {
            return null;
        }
    }
`;

const functionalComponentWithoutDisplayName = `
    const Test = () => null;
`;

const classComponentWithDisplayName = `
    class Test extends Component {
        render() {
            return null;
        }
    }
    Test.displayName = 'Test';
`;

ruleTester.run('display-name-property', rule, {
    valid: [
        {
            code: functionalComponentWithDisplayName,
            filename: './src/components/Test.js',
        },
        {
            code: classComponentWithoutDisplayName,
            filename: './src/components/Test.js',
        },
        {
            code: functionalComponentWithDisplayName,
            filename: './src/components/Test/index.js',
        },
        {
            code: classComponentWithoutDisplayName,
            filename: './src/components/Test/index.js',
        },
        {
            code: functionalComponentWithDisplayName,
            filename: './src/components/Test/index.native.js',
        },
        {
            code: classComponentWithoutDisplayName,
            filename: './src/components/Test/index.native.js',
        },
    ],
    invalid: [
        {
            code: functionalComponentWithoutDisplayName,
            filename: './src/components/Test.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_FUNCTION,
            }],
        },
        {
            code: classComponentWithDisplayName,
            filename: './src/components/Test.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_CLASS,
            }],
        },
        {
            code: functionalComponentWithoutDisplayName,
            filename: './src/components/Test/index.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_FUNCTION,
            }],
        },
        {
            code: classComponentWithDisplayName,
            filename: './src/components/Test/index.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_CLASS,
            }],
        },
        {
            code: functionalComponentWithoutDisplayName,
            filename: './src/components/Test/index.native.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_FUNCTION,
            }],
        },
        {
            code: classComponentWithDisplayName,
            filename: './src/components/Test/index.native.js',
            errors: [{
                message: DISPLAY_NAME_PROPERTY_CLASS,
            }],
        },
    ],
});
