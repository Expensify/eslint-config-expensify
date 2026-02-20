import {RuleTester} from 'eslint';
import parser from '@typescript-eslint/parser';
import * as rule from '../no-set-return-in-useOnyx-selector.js';

const ruleTester = new RuleTester({
    languageOptions: {
        parser,
        parserOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
        },
    },
});

ruleTester.run('no-set-return-in-useOnyx-selector', rule, {
    valid: [
        // Selector returns array - should not error
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => Object.keys(d), canBeMissing: true});',
        },

        // No selector option - should not error
        {
            code: 'const [data] = useOnyx(KEY, {canBeMissing: false});',
        },

        // Selector returns object - should not error
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => ({id: d.id}), canBeMissing: true});',
        },

        // useOnyx with only one argument - should not error
        {
            code: 'const [data] = useOnyx(KEY);',
        },

        // Not a useOnyx call - should not error
        {
            code: 'const [data] = useState({selector: () => new Set()});',
        },

        // Selector as identifier with no Set return - should not error
        {
            code: 'const mySelector = (d) => Object.keys(d); const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});',
        },

        // new Set() outside of useOnyx selector - should not error
        {
            code: `
                const [data] = useOnyx(KEY, {selector: (d) => Object.keys(d), canBeMissing: true});
                const mySet = new Set(data);
            `,
        },

        // Options as variable without selector - should not error
        {
            code: `
                const options = {canBeMissing: false};
                const [data] = useOnyx(KEY, options);
            `,
        },

        // Selector with block body returning array - should not error
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => { return Object.keys(d); }, canBeMissing: true});',
        },
    ],
    invalid: [
        // Inline arrow implicit return with new Set()
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => new Set(Object.keys(d)), canBeMissing: true});',
            errors: [{
                messageId: 'noSetReturn',
            }],
        },

        // Inline arrow block body with return new Set()
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => { return new Set(d); }, canBeMissing: true});',
            errors: [{
                messageId: 'noSetReturn',
            }],
        },

        // Variable selector with new Set() in body
        {
            code: `
                const mySelector = (d) => new Set(Object.keys(d));
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetReturn',
            }],
        },

        // useCallback wrapped selector with new Set()
        {
            code: `function MyComponent() {
                const mySelector = useCallback((d) => new Set(d), []);
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
                return null;
            }`,
            errors: [{
                messageId: 'noSetReturn',
            }],
        },

        // TypeScript Set<string> return type annotation
        {
            code: `
                const mySelector = (d: Record<string, unknown>): Set<string> => { return new Set(Object.keys(d)); };
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetReturn',
            }],
        },

        // TypeScript ReadonlySet<string> return type annotation
        {
            code: `
                const mySelector = (d: Record<string, unknown>): ReadonlySet<string> => { return new Set(Object.keys(d)); };
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetReturn',
            }],
        },

        // Options as variable reference with Set-returning selector
        {
            code: `
                const options = {selector: (d) => new Set(d), canBeMissing: true};
                const [data] = useOnyx(KEY, options);
            `,
            errors: [{
                messageId: 'noSetReturn',
            }],
        },

        // Variable tracing: const s = new Set(); return s;
        {
            code: `
                const mySelector = (d) => {
                    const result = new Set(Object.keys(d));
                    return result;
                };
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetReturn',
            }],
        },

        // Inline function expression with new Set()
        {
            code: 'const [data] = useOnyx(KEY, {selector: function(d) { return new Set(d); }, canBeMissing: true});',
            errors: [{
                messageId: 'noSetReturn',
            }],
        },

        // Shorthand selector property with Set return
        {
            code: `
                const selector = (d) => new Set(d);
                const [data] = useOnyx(KEY, {selector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetReturn',
            }],
        },
    ],
});
