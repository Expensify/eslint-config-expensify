import {RuleTester} from 'eslint';
import * as rule from '../no-thenable-actions-in-views.js';
import CONST from '../CONST.js';

const ruleTester = new RuleTester({languageOptions: {ecmaVersion: 2020, sourceType: 'module'}});
const actionCall = "import Foo from '../actions/Foo'; Foo.go().then(done);";

ruleTester.run('no-thenable-actions-in-views', rule, {
    valid: [
        {code: actionCall, filename: './src/libs/Foo.js'},
        {code: "import Foo from '../actions/Foo'; Foo.go();", filename: './src/components/Foo.js'},
        {code: 'Other.go().then(done);', filename: './src/components/Foo.js'},
    ],
    invalid: [
        {
            code: actionCall,
            filename: './src/components/Foo.js',
            errors: [{message: CONST.MESSAGE.NO_THENABLE_ACTIONS_IN_VIEWS.replace('{{method}}', 'Foo.go()')}],
        },
        {
            code: actionCall,
            filename: './src/pages/Foo.js',
            errors: [{message: CONST.MESSAGE.NO_THENABLE_ACTIONS_IN_VIEWS.replace('{{method}}', 'Foo.go()')}],
        },
    ],
});
