import {RuleTester} from 'eslint';
import parser from '@typescript-eslint/parser';
import * as rule from '../no-set-or-map-return-in-useOnyx-selector.js';

const ruleTester = new RuleTester({
    languageOptions: {
        parser,
        parserOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
        },
    },
});

ruleTester.run('no-set-or-map-return-in-useOnyx-selector', rule, {
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

        // Not a useOnyx call - should not error (Set)
        {
            code: 'const [data] = useState({selector: () => new Set()});',
        },

        // Not a useOnyx call - should not error (Map)
        {
            code: 'const [data] = useState({selector: () => new Map()});',
        },

        // Selector as identifier with no Set/Map return - should not error
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

        // new Map() outside of useOnyx selector - should not error
        {
            code: `
                const [data] = useOnyx(KEY, {selector: (d) => Object.entries(d), canBeMissing: true});
                const myMap = new Map(data);
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

        // Array.from wrapping a Set - return value is an Array, not a Set
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => Array.from(new Set(d)), canBeMissing: true});',
        },

        // Array.from wrapping a Map - return value is an Array, not a Map
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => Array.from(new Map(d)), canBeMissing: true});',
        },

        // Spread Set into array literal - return value is an Array
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => [...new Set(d)], canBeMissing: true});',
        },

        // Spread Map into array literal - return value is an Array
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => [...new Map(d)], canBeMissing: true});',
        },

        // Set used internally for dedup, but returns spread array
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => { const s = new Set(d); return [...s]; }, canBeMissing: true});',
        },

        // Map used internally, but returns spread array
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => { const m = new Map(d); return [...m]; }, canBeMissing: true});',
        },

        // Imported selector cannot be resolved - should not error
        {
            code: `
                import {mySelector} from './selectors';
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
        },
    ],
    invalid: [
        // --- Set cases ---

        // Inline arrow implicit return with new Set()
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => new Set(Object.keys(d)), canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Inline arrow block body with return new Set()
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => { return new Set(d); }, canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Variable selector with new Set() in body
        {
            code: `
                const mySelector = (d) => new Set(Object.keys(d));
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
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
                messageId: 'noSetOrMapReturn',
            }],
        },

        // TypeScript Set<string> return type annotation
        {
            code: `
                const mySelector = (d: Record<string, unknown>): Set<string> => { return new Set(Object.keys(d)); };
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // TypeScript ReadonlySet<string> return type annotation
        {
            code: `
                const mySelector = (d: Record<string, unknown>): ReadonlySet<string> => { return new Set(Object.keys(d)); };
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Options as variable reference with Set-returning selector
        {
            code: `
                const options = {selector: (d) => new Set(d), canBeMissing: true};
                const [data] = useOnyx(KEY, options);
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
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
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Inline function expression with new Set()
        {
            code: 'const [data] = useOnyx(KEY, {selector: function(d) { return new Set(d); }, canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Shorthand selector property with Set return
        {
            code: `
                const selector = (d) => new Set(d);
                const [data] = useOnyx(KEY, {selector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Ternary in implicit arrow return - both branches return Set
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => d ? new Set(d) : new Set(), canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Ternary in implicit arrow return - one branch returns Set
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => d ? new Set(d) : [], canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Return statement with ternary - Set in consequent
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => { return d ? new Set(d) : []; }, canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // useMemo-wrapped selector returning Set (implicit factory return)
        {
            code: `function MyComponent() {
                const sel = useMemo(() => (d) => new Set(d), []);
                const [data] = useOnyx(KEY, {selector: sel, canBeMissing: true});
                return null;
            }`,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // useMemo-wrapped selector returning Set (block factory body)
        {
            code: `function MyComponent() {
                const sel = useMemo(() => { return (d) => new Set(d); }, []);
                const [data] = useOnyx(KEY, {selector: sel, canBeMissing: true});
                return null;
            }`,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // --- Map cases ---

        // Inline arrow implicit return with new Map()
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => new Map(Object.entries(d)), canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Inline arrow block body with return new Map()
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => { return new Map(Object.entries(d)); }, canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Variable selector with new Map() in body
        {
            code: `
                const mySelector = (d) => new Map(Object.entries(d));
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // useCallback wrapped selector with new Map()
        {
            code: `function MyComponent() {
                const mySelector = useCallback((d) => new Map(Object.entries(d)), []);
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
                return null;
            }`,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // TypeScript Map<string, unknown> return type annotation
        {
            code: `
                const mySelector = (d: Record<string, unknown>): Map<string, unknown> => { return new Map(Object.entries(d)); };
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // TypeScript ReadonlyMap<string, unknown> return type annotation
        {
            code: `
                const mySelector = (d: Record<string, unknown>): ReadonlyMap<string, unknown> => { return new Map(Object.entries(d)); };
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Options as variable reference with Map-returning selector
        {
            code: `
                const options = {selector: (d) => new Map(Object.entries(d)), canBeMissing: true};
                const [data] = useOnyx(KEY, options);
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Variable tracing: const m = new Map(); return m;
        {
            code: `
                const mySelector = (d) => {
                    const result = new Map(Object.entries(d));
                    return result;
                };
                const [data] = useOnyx(KEY, {selector: mySelector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Inline function expression with new Map()
        {
            code: 'const [data] = useOnyx(KEY, {selector: function(d) { return new Map(Object.entries(d)); }, canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Shorthand selector property with Map return
        {
            code: `
                const selector = (d) => new Map(Object.entries(d));
                const [data] = useOnyx(KEY, {selector, canBeMissing: true});
            `,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Ternary in implicit arrow return - both branches return Map
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => d ? new Map(Object.entries(d)) : new Map(), canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Ternary in implicit arrow return - one branch returns Map
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => d ? new Map(Object.entries(d)) : [], canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // Return statement with ternary - Map in consequent
        {
            code: 'const [data] = useOnyx(KEY, {selector: (d) => { return d ? new Map(Object.entries(d)) : []; }, canBeMissing: true});',
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // useMemo-wrapped selector returning Map (implicit factory return)
        {
            code: `function MyComponent() {
                const sel = useMemo(() => (d) => new Map(Object.entries(d)), []);
                const [data] = useOnyx(KEY, {selector: sel, canBeMissing: true});
                return null;
            }`,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },

        // useMemo-wrapped selector returning Map (block factory body)
        {
            code: `function MyComponent() {
                const sel = useMemo(() => { return (d) => new Map(Object.entries(d)); }, []);
                const [data] = useOnyx(KEY, {selector: sel, canBeMissing: true});
                return null;
            }`,
            errors: [{
                messageId: 'noSetOrMapReturn',
            }],
        },
    ],
});
