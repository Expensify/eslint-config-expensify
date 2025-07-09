const RuleTester = require('eslint').RuleTester;
const rule = require('../no-empty-array-object-default-in-useOnyx');

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
});

ruleTester.run('no-empty-array-object-default-in-useOnyx', rule, {
    valid: [
        {
            code: 'const [data = getEmptyObject()] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data = getEmptyArray()] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data = null] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data = undefined] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data = false] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data = ""] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data = 0] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data = someVariable] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data = {key: "value"}] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const [data = ["item"]] = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: 'const data = useOnyx(ONYXKEYS.DATA);',
        },
    ],
    invalid: [
        {
            code: 'const [data = {}] = useOnyx(ONYXKEYS.DATA);',
            errors: [{
                messageId: 'noEmptyObjectDefault',
            }],
        },
        {
            code: 'const [data = []] = useOnyx(ONYXKEYS.DATA);',
            errors: [{
                messageId: 'noEmptyArrayDefault',
            }],
        },
    ],
});
