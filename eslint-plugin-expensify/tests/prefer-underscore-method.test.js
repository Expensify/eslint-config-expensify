const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-underscore-method');
const message = require('../CONST').MESSAGE.PREFER_UNDERSCORE_METHOD;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('prefer-underscore-method', rule, {
    valid: [
        {
            code: 'const test = _.includes([], \'derp\');',
        },
        {
            code: 'const test = _.filter([], () => {});',
        },
        {
            code: 'const test = \'test\'.includes(\'test\')',
        },
        {
            code: 'test.each(() => {});',
        },
        {
            code: 'describe.each(() => {});',
        },
        {
            code: 'React.Children.map(children, child => child);',
        },
    ],
    invalid: [
        {
            code: 'const test = [].filter(() => {});',
            errors: [{
                message: message.replace('{{method}}', 'filter'),
            }],
        },
        {
            code: 'const test = [].map(() => {});',
            errors: [{
                message: message.replace('{{method}}', 'map'),
            }],
        },
        {
            code: 'const test = [].reduce(() => {}, {});',
            errors: [{
                message: message.replace('{{method}}', 'reduce'),
            }],
        },
    ],
});
