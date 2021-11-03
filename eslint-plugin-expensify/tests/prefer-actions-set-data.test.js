const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-actions-set-data');
const message = require('../CONST').MESSAGE.PREFER_ACTIONS_SET_DATA;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

const goodExample = `
function setData() {
    Onyx.set('key', {value: 'test'});
}
`;

const badExample = `
class MyComponent extends React.Component {
    setValue(value) {
        Onyx.set('testValue', value);
    }

    render() {
        return null;
    }
}
`;

ruleTester.run('prefer-actions-set-data', rule, {
    valid: [
        {
            code: goodExample,

            // Mock filename - it's acceptable to use Onyx in an action file, but not component
            filename: './src/libs/actions/Test.js',
        },
    ],
    invalid: [
        {
            code: badExample,
            errors: [{
                message,
            }],
            filename: './src/components/Test.js',
        },
        {
            code: badExample,
            errors: [{
                message,
            }],
            filename: './src/pages/report/Test.js',
        },
    ],
});
