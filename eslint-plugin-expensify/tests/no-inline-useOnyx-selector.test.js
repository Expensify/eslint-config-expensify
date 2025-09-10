const RuleTester = require('eslint').RuleTester;
const rule = require('../no-inline-useOnyx-selector');

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
});

ruleTester.run('no-inline-useOnyx-selector', rule, {
    valid: [
        // No selector - should not error
        {
            code: 'const [data] = useOnyx(ONYXKEYS.DATA, {canBeMissing: false});',
        },

        // Selector as variable reference - should not error
        {
            code: 'const selector = (data) => data.value; const [data] = useOnyx(ONYXKEYS.DATA, {selector, canBeMissing: false});',
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
    ],
});
