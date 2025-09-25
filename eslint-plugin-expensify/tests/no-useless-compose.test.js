import {RuleTester} from 'eslint';
import * as rule from '../no-useless-compose.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.NO_USELESS_COMPOSE;

const ruleTester = new RuleTester({
    languageOptions: {
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
