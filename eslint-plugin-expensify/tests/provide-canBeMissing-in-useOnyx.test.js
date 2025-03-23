const RuleTester = require('eslint').RuleTester;
const rule = require('../provide-canBeMissing-in-useOnyx');

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
});

ruleTester.run('provide-canBeMissing-in-useOnyx', rule, {
    valid: [
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {allowStaleData: true, canBeMissing: false});',
        },
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {canBeMissing: false}, []);',
        },
        {
            code: `
                const options = {allowStaleData: true, canBeMissing: false};
                const [data] = useOnyx(ONYXKEYS.DATA, options);
            `,
        },
    ],
    invalid: [
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA);',
            errors: [{
                messageId: 'provideCanBeMissing',
            }],
        },
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {allowStaleData: true});',
            errors: [{
                messageId: 'provideCanBeMissing',
            }],
        },
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, undefined, []);',
            errors: [{
                messageId: 'provideCanBeMissing',
            }],
        },
        {
            code: `
                const options = {allowStaleData: true};
                const [data] = useOnyx(ONYXKEYS.DATA, options);
            `,
            errors: [{
                messageId: 'provideCanBeMissing',
            }],
        },
        {
            code: `
                const undefinedOptions = undefined;
                const [data] = useOnyx(ONYXKEYS.DATA, undefinedOptions);
            `,
            errors: [{
                messageId: 'provideCanBeMissing',
            }],
        },
    ],
});
