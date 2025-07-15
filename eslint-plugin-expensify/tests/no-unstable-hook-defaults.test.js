const RuleTester = require('eslint').RuleTester;
const rule = require('../no-unstable-hook-defaults');

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
});

ruleTester.run('no-unstable-hook-defaults', rule, {
    valid: [
        {
            code: 'const [data = getEmptyObject()] = useHook();',
        },
        {
            code: 'const [data = getEmptyArray()] = useHook();',
        },
        {
            code: 'const [data] = useHook();',
        },
        {
            code: 'const [data = null] = useHook();',
        },
        {
            code: 'const [data = undefined] = useHook();',
        },
        {
            code: 'const [data = false] = useHook();',
        },
        {
            code: 'const [data = ""] = useHook();',
        },
        {
            code: 'const [data = 0] = useHook();',
        },
        {
            code: 'const data = useHook();',
        },
        {
            code: `
                const CONST_VALUE = {key: "value"};
                function Component() {
                    const [data = CONST_VALUE] = useHook();
                }
            `,
        },
        {
            code: `
                function Component() {
                    const memoizedValue = useMemo(() => ({key: "value"}), []);
                    const [data = memoizedValue] = useHook();
                }
            `,
        },
        {
            code: 'const {value1 = getEmptyObject(), value2 = getEmptyArray()} = useHook();',
        },
        {
            code: 'const {value1 = null, value2 = undefined} = useHook();',
        },
        {
            code: 'const {value1, value2} = useHook();',
        },
        {
            code: `
                const CONST_VALUE = {key: "value"};
                function Component() {
                    const {value1 = CONST_VALUE} = useHook();
                }
            `,
        },
        {
            code: `
                function Component() {
                    const memoizedValue = useMemo(() => ({key: "value"}), []);
                    const {value1 = memoizedValue} = useHook();
                }
            `,
        },
    ],
    invalid: [
        {
            code: 'const [data = {}] = useHook();',
            errors: [{
                messageId: 'noEmptyObjectDefault',
            }],
        },
        {
            code: 'const [data = []] = useHook();',
            errors: [{
                messageId: 'noEmptyArrayDefault',
            }],
        },
        {
            code: 'const [data = {key: "value"}] = useHook();',
            errors: [{
                messageId: 'noInlineObjectDefault',
            }],
        },
        {
            code: 'const [data = ["item"]] = useHook();',
            errors: [{
                messageId: 'noInlineArrayDefault',
            }],
        },
        {
            code: `
                function Component() {
                    const notMemoizedValue = {key: "value"};
                    const [data = notMemoizedValue] = useHook();
                }
            `,
            errors: [{messageId: 'noUnstableIdentifierDefault'}],
        },
        {
            code: 'const {value1 = []} = useHook();',
            errors: [{messageId: 'noEmptyArrayDefault'}],
        },
        {
            code: 'const {value1 = {}} = useHook();',
            errors: [{messageId: 'noEmptyObjectDefault'}],
        },
        {
            code: 'const {value1 = {key: "value"}} = useHook();',
            errors: [{messageId: 'noInlineObjectDefault'}],
        },
        {
            code: 'const {value1 = ["item"]} = useHook();',
            errors: [{messageId: 'noInlineArrayDefault'}],
        },
        {
            code: `
                function Component() {
                    const notMemoizedValue = {key: "value"};
                    const {value1 = notMemoizedValue} = useHook();
                }
            `,
            errors: [{messageId: 'noUnstableIdentifierDefault'}],
        },
    ],
});
