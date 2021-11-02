const RuleTester = require('eslint').RuleTester;
const rule = require('../no-useless-compose');
const message = require('../CONST').MESSAGE.NO_USELESS_COMPOSE;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('no-useless-compose', rule, {
    valid: [
        {
            code: 'export default compose(withLocalize, withWindowDimensions);',
        },
    ],
    invalid: [
        {
            code: 'export default compose(withLocalize);',
            errors: [{
                message,
            }],
        },
    ],
});
