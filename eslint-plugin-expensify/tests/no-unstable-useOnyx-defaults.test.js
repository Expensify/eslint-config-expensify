const RuleTester = require('eslint').RuleTester;
const rule = require('../no-unstable-useOnyx-defaults');

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
});

ruleTester.run('no-unstable-useOnyx-defaults', rule, {
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
            code: 'const data = useOnyx(ONYXKEYS.DATA);',
        },
        {
            code: `
                const CONST_VALUE = {key: "value"};
                function Component() {
                    const [data = CONST_VALUE] = useOnyx(ONYXKEYS.DATA);
                }
            `,
        },
        {
            code: `
                function Component() {
                    const memoizedValue = useMemo(() => ({key: "value"}), []);
                    const [data = memoizedValue] = useOnyx(ONYXKEYS.DATA);
                }
            `,
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
        {
            code: 'const [data = {key: "value"}] = useOnyx(ONYXKEYS.DATA);',
            errors: [{
                messageId: 'noInlineObjectDefault',
            }],
        },
        {
            code: 'const [data = ["item"]] = useOnyx(ONYXKEYS.DATA);',
            errors: [{
                messageId: 'noInlineArrayDefault',
            }],
        },
        {
            code: `
                function Component() {
                    const notMemoizedValue = {key: "value"};
                    const [data = notMemoizedValue] = useOnyx(ONYXKEYS.DATA);
                }
            `,
            errors: [{messageId: 'noUnstableIdentifierDefault'}],
        },
    ],
});
