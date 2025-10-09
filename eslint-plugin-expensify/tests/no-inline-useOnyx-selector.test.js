const { RuleTester } = require('eslint');
const rule = require('../no-inline-useOnyx-selector');

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
    },
});

ruleTester.run('no-inline-useOnyx-selector', rule, {
    valid: [
        // No selector - should not error
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {canBeMissing: false});',
        },


        // Selector as identifier reference - should not error
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {selector: mySelector, canBeMissing: false});',
        },

        // Options as variable with non-inline selector - should not error
        {
            code: 'const selector = (data) => data.value; const options = {selector, canBeMissing: false}; const [data] = useOnyx(ONYXKEYS.DATA, options);',
        },

        // Options as variable with identifier selector - should not error
        {
            code: 'const options = {selector: mySelector, canBeMissing: false}; const [data] = useOnyx(ONYXKEYS.DATA, options);',
        },

        // No useOnyx call - should not error
        {
            code: 'const [data] = useState({selector: () => {}});',
        },

        // useOnyx with only one argument - should not error
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA);',
        },

        // Selector defined with useCallback within component - should not error
        {
            code: `function MyComponent() {
                const memoizedSelector = useCallback((val) => ({someProp: val.someProp}), []);
                const [data] = useOnyx(ONYXKEYS.DATA, {selector: memoizedSelector});
                return null;
            }`,
        },

        // Selector defined outside component - should not error
        {
            code: `const externalSelector = (val) => ({someProp: val.someProp});
            function MyComponent() {
                const [data] = useOnyx(ONYXKEYS.DATA, {selector: externalSelector});
                return null;
            }`,
        },

        // Selector defined with useCallback in options object within component - should not error
        {
            code: `function MyComponent() {
                const memoizedSelector = useCallback((val) => ({someProp: val.someProp}), []);
                const options = {selector: memoizedSelector};
                const [data] = useOnyx(ONYXKEYS.DATA, options);
                return null;
            }`,
        },

        // Non-component function with non-memoized selector - should not error
        {
            code: `function normalFunction() {
                const nonMemoizedSelector = (val) => ({someProp: val.someProp});
                const [data] = useOnyx(ONYXKEYS.DATA, {selector: nonMemoizedSelector});
                return null;
            }`,
        },
    ],
    invalid: [
        // Inline arrow function selector - should error
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {selector: (data) => data.value, canBeMissing: false});',
            errors: [{
                messageId: 'noInlineSelector',
            }],
        },

        // Inline function expression selector - should error
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {selector: function(data) { return data.value; }, canBeMissing: false});',
            errors: [{
                messageId: 'noInlineSelector',
            }],
        },

        // Complex inline arrow function - should error
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {selector: (data) => { return data?.items?.filter(item => item.active); }, canBeMissing: false});',
            errors: [{
                messageId: 'noInlineSelector',
            }],
        },

        // Inline selector with other options - should error
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {allowStaleData: true, selector: (data) => data.value, canBeMissing: false});',
            errors: [{
                messageId: 'noInlineSelector',
            }],
        },

        // Options as variable with inline selector - should error
        {
            code: 'const options = {selector: (data) => data.value, canBeMissing: false}; const [data] = useOnyx(ONYXKEYS.DATA, options);',
            errors: [{
                messageId: 'noInlineSelector',
            }],
        },

        // Options as variable with inline function expression - should error
        {
            code: 'const options = {selector: function(data) { return data.value; }, canBeMissing: false}; const [data] = useOnyx(ONYXKEYS.DATA, options);',
            errors: [{
                messageId: 'noInlineSelector',
            }],
        },

        // Multiple useOnyx calls, one with inline selector - should error on the one with inline selector
        {
            code: 'const [data1] = useOnyx(ONYXKEYS.DATA1, {canBeMissing: false}); const [data2] = useOnyx(ONYXKEYS.DATA2, {selector: (data) => data.value, canBeMissing: false});',
            errors: [{
                messageId: 'noInlineSelector',
            }],
        },

        // Non-memoized selector defined within component - should error
        {
            code: `function MyComponent() {
                const myNonMemoizedSelector = (val) => ({someProp: val.someProp, someOtherProp: val.someOtherProp});
                const [data] = useOnyx(MY_ONYX_KEY, {selector: myNonMemoizedSelector});
                return null;
            }`,
            errors: [{
                messageId: 'noNonMemoizedSelector',
            }],
        },

        // Non-memoized selector in options object within component - should error
        {
            code: `function MyComponent() {
                const myNonMemoizedSelector = (val) => ({someProp: val.someProp});
                const options = {selector: myNonMemoizedSelector, canBeMissing: false};
                const [data] = useOnyx(MY_ONYX_KEY, options);
                return null;
            }`,
            errors: [{
                messageId: 'noNonMemoizedSelector',
            }],
        },

        // Arrow function component with non-memoized selector - should error
        {
            code: `const MyComponent = () => {
                const myNonMemoizedSelector = (val) => ({someProp: val.someProp});
                const [data] = useOnyx(MY_ONYX_KEY, {selector: myNonMemoizedSelector});
                return null;
            };`,
            errors: [{
                messageId: 'noNonMemoizedSelector',
            }],
        },
    ],
});