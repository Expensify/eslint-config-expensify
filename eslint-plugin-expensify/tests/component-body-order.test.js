/* eslint-disable rulesdir/prefer-underscore-method */
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {Linter, RuleTester} from 'eslint';
import tsParser from '@typescript-eslint/parser';
import * as rule from '../component-body-order.js';

const ruleTester = new RuleTester({
    languageOptions: {
        parser: tsParser,
        parserOptions: {ecmaFeatures: {jsx: true}},
    },
});

ruleTester.run(rule.name, rule, {
    valid: [
        `function Component() {
            const context = useContext(Context);
            const [data] = useOnyx(KEY);
            const [state] = useState(0);
            const value = derive(data);
            const submit = () => value;
            useEffect(submit, [submit]);
            return <View />;
        }`,
        'function useValue() { const value = derive(); useEffect(() => value, [value]); return value; }',

        // Hook order is an invariant, even when it disagrees with the preferred groups.
        'function Component() { const [state] = useState(0); const [data] = useOnyx(KEY); return data; }',
        'function Component() { useEffect(effect, []); const state = React.useState(0); return state; }',

        // A value needed by a subscription cannot move below it.
        'function Component({id}) { const key = makeKey(id); const [data] = useOnyx(key); return data; }',

        // Captured references matter, including references that appear before the declaration.
        'function Component() { const submit = () => value; const value = derive(); return value; }',
        'function Component() { const submit = () => 1; const value = derive(submit); return value; }',
        'function Component() { useEffect(() => value, []); const value = derive(); return value; }',

        // Unknown statements and mutable declarations are barriers.
        'function Component() { useEffect(effect, []); log(); const value = derive(); return value; }',
        'function Component() { useEffect(effect, []); let value = derive(); return value; }',
        'function Component() { useEffect(effect, []); const first = 1, second = 2; return first; }',
        'function ordinary() { useEffect(effect, []); const value = derive(); return value; }',
        'function Factory() { return function Inner() { useEffect(effect, []); const value = derive(); return value; }; }',
        'const Component = () => <View />;',
        'async function Component() { useEffect(effect, []); const value = derive(); return value; }',
        'function Component() { useEffect(effect, []); const state = useState(0) as State; return state; }',
        'function Component() { useEffect(effect, []); const state = useState(0)!; return state; }',
        'function Component() { useEffect(effect, []); const state = useState(0) satisfies State; return state; }',
        {filename: 'component.ts', code: 'function Component() { useEffect(effect, []); const state = <State>useState(0); return state; }'},
        'function Component() { useEffect(effect, []); const state = Other.useState(0); return state; }',
        'function Component() { useEffect(effect, []); const state = React["useState"](0); return state; }',
        'import {useState as readState} from "react"; function Component() { useEffect(effect, []); const state = readState(0); return state; }',
        'function Component() { useEffect(effect, []); const value = decorate(useCustom()); return value; }',
        'function Component() { useEffect(effect, []); const value = flag ? useCustom() : null; return value; }',
        'function Component() { useEffect(effect, []); const {value = useCustom()} = input; return value; }',
        'function Component(props) { const {value} = props; const context = useContext(Context); return value; }',
        'function Component() { useEffect(effect, []); const view = <View />; return view; }',
        'export default function ordinary() { useEffect(effect, []); const value = derive(); return value; }',
        'function Component() { useEffect(effect, []); const state = (() => useState(0))(); return state; }',
        'function Component() { useEffect(effect, []); const state = (function () { return useState(0); })(); return state; }',
        'function Component() { useEffect(effect, []); const state = React[`useState`](0); return state; }',
        'function Component() { useEffect(effect, []); const state = React[hookName](0); return state; }',
        'function Component() { useEffect(effect, []); const state = readState(0); return state; } import {useState as readState} from "react";',
        'function Component() { useEffect(effect, []); if (!ready) { return null; } const value = derive(); return value; }',
        'function Component() { return null; const value = derive(); }',
        'function Component() { const submit = () => value; const value = 1; return submit; }',
        'function Component() { const submit = () => 1; const state = useState(submit); return state; }',
        'function Component() { const submit = () => state; const state = useState(0); return submit; }',
        'function Component() { useEffect(() => value, []); const value = 1; return value; }',
        'async function Component() { useEffect(effect, []); const value = 1; await wait(); return value; }',
        'function* Component() { useEffect(effect, []); const value = 1; yield value; }',
        'function Component() { useEffect(effect, []); if (flag) { return null; } const value = 1; return value; }',
        'function Component() { useEffect(effect, []); const first = 1, second = 2; return [first, second]; }',
    ],
    invalid: [
        {
            code: 'function Component() { useEffect(effect, []); const value = derive(); return <View value={value} />; }',
            errors: [{messageId: 'order', data: {group: 'derived values', previous: 'effects'}}],
            output: null,
        },
        {
            code: 'const Component = () => { const submit = () => 1; const value = derive(); return value; };',
            errors: [{messageId: 'order', data: {group: 'derived values', previous: 'handlers'}}],
            output: null,
        },
        {
            code: 'export function useValue() { const value = derive(); const context = useContext(Context); return [value, context]; }',
            errors: [{messageId: 'order', data: {group: 'inputs/context', previous: 'derived values'}}],
            output: null,
        },
        {
            code: 'function Component() { React.useEffect(effect, []); const submit = () => 1; return submit; }',
            errors: [{messageId: 'order', data: {group: 'handlers', previous: 'effects'}}],
            output: 'function Component() { const submit = () => 1; React.useEffect(effect, []); return submit; }',
        },
        {
            code: 'function Component() { function submit() {} const value: number = derive(); return value; }',
            errors: [{messageId: 'order'}],
            output: null,
        },
        {
            code: 'function Component() { useEffect(effect, []); const value = 1; const state = useState(0); return [value, state]; }',
            errors: [{messageId: 'order', data: {group: 'derived values', previous: 'effects'}}],
            output: 'function Component() { const value = 1; useEffect(effect, []); const state = useState(0); return [value, state]; }',
        },
        {
            code: 'import {useState as readState} from "react"; function Component(readState) { useEffect(effect, []); const value = readState(); return value; }',
            errors: [{messageId: 'order', data: {group: 'derived values', previous: 'effects'}}],
            output: null,
        },
        ...[
            'const Component = memo(() => { useEffect(effect, []); const value = derive(); return value; });',
            'const Component = React.forwardRef((props, ref) => { useEffect(effect, []); const value = derive(); return value; });',
            'const Component = memo(forwardRef((props, ref) => { useEffect(effect, []); const value = derive(); return value; }));',
            'import {memo as cached} from "react"; const Component = cached(() => { useEffect(effect, []); const value = derive(); return value; });',
            'const Component = function inner() { useEffect(effect, []); const value = derive(); return value; };',
            'export default function () { useEffect(effect, []); const value = derive(); return <View value={value} />; }',
        ].map(code => ({code, errors: [{messageId: 'order', suggestions: []}], output: null})),
        ...[
            ['function Component() { useEffect(effect, []); const submit = () => useSomething(); return submit; }',
                'function Component() { const submit = () => useSomething(); useEffect(effect, []); return submit; }'],
            ['function Component() { useEffect(effect, []); const getDefaultValues = () => defaults.value; return getDefaultValues(); }',
                'function Component() { const getDefaultValues = () => defaults.value; useEffect(effect, []); return getDefaultValues(); }'],
            ['function Component() { useEffect(effect, []); const getDefaultValues = function defaults() { return input.value; }; return getDefaultValues(); }',
                'function Component() { const getDefaultValues = function defaults() { return input.value; }; useEffect(effect, []); return getDefaultValues(); }'],
            ['function Component() { useEffect(effect, []); const submit = () => 1; return <View onPress={submit} />; }',
                'function Component() { const submit = () => 1; useEffect(effect, []); return <View onPress={submit} />; }'],
            ['function Component() { useEffect(effect, []); const submit = () => 1; return {submit}; }',
                'function Component() { const submit = () => 1; useEffect(effect, []); return {submit}; }'],
            ['function Component() { const submit = function () { return 1; }; const value = 2 + 3; return [submit, value]; }',
                'function Component() { const value = 2 + 3; const submit = function () { return 1; }; return [submit, value]; }'],
            ['function Component() { const submit = () => 1; const state = useState(0); return [submit, state]; }',
                'function Component() { const state = useState(0); const submit = () => 1; return [submit, state]; }'],
            ['import {useEffect as effectHook} from "react"; function Component() { effectHook(effect, []); const value = 1 as number; return value; }',
                'import {useEffect as effectHook} from "react"; function Component() { const value = 1 as number; effectHook(effect, []); return value; }'],
            ['function Component() { React["useEffect"](effect, []); const value = 1; return value; }',
                'function Component() { const value = 1; React["useEffect"](effect, []); return value; }'],
            ['function Component() { "use strict"; useEffect(effect, []); const value = 1; return value; }',
                'function Component() { "use strict"; const value = 1; useEffect(effect, []); return value; }'],
            ['function Component() {\n    useEffect(effect, [])\n    const value = 1\n    return value\n}',
                'function Component() {\n    const value = 1;\n    useEffect(effect, []);\n    return value\n}'],
            ['function Component() {\n    (useEffect)(effect, [])\n    const submit = () => 1\n    return submit\n}',
                'function Component() {\n    const submit = () => 1;\n    (useEffect)(effect, []);\n    return submit\n}'],
            ['function Component() { useEffect(effect, []); const unsafe = read(); useEffect(effect, []); const value = 1; return [unsafe, value]; }',
                'function Component() { useEffect(effect, []); const unsafe = read(); const value = 1; useEffect(effect, []); return [unsafe, value]; }'],
            ['function Component() { useEffect(effect, []); const submit = () => 1; const value = 2; const state = useState(0); return [submit, value, state]; }',
                'function Component() { const value = 2; const submit = () => 1; useEffect(effect, []); const state = useState(0); return [submit, value, state]; }'],
        ].map(([code, output]) => ({code, output, errors: [{messageId: 'order'}]})),
        // eslint-disable-next-line no-template-curly-in-string -- The template is source text for the rule tester.
        ...['null', '!false', 'typeof 1', 'true ? 1 : 2', 'false || 2', '`value${1 + 2}`', '(1 as number)!'].map(initializer => ({
            code: `function Component() { useEffect(effect, []); const value = ${initializer}; return value; }`,
            output: `function Component() { const value = ${initializer}; useEffect(effect, []); return value; }`,
            errors: [{messageId: 'order'}],
        })),
        ...[
            // Allocations and later mutations remain together on the same side of hooks.
            'function Component() { const value = []; const state = useState(0); value.push(state); return value; }',
            'function Component() { const value = {}; const state = useState(0); value.state = state; return value; }',
            'function Component() { const value = build(); const state = useState(0); value.push(state); return value; }',
            'function Component() { useEffect(effect, []); const handler = () => 1; handler.value = 1; return handler; }',
            'function Component() { useEffect(effect, []); const handler = () => 1; handler["value"] = 1; return handler; }',
            'function Component() { useEffect(effect, []); const handler = () => 1; handler.value++; return handler; }',
            'function Component() { useEffect(effect, []); const handler = () => 1; delete handler.value; return handler; }',
            'function Component() { useEffect(effect, []); const handler = () => 1; Object.assign(handler, properties); return handler; }',
            'function Component() { useEffect(effect, []); const handler = () => 1; mutate(handler); return handler; }',
            'function Component() { useEffect(effect, []); const handler = () => 1; const alias = handler; mutate(alias); return handler; }',
            'function Component() { useEffect(effect, []); const handler = () => 1; const callbacks = [handler]; mutate(callbacks); return handler; }',
            'function Component() { useEffect(effect, []); const handler = () => 1; holder.callback = handler; mutate(holder); return handler; }',
            'function Component() { useEffect(effect, []); const handler = () => { handler.value = 1; }; handler(); return handler; }',
            'function Component() { useEffect(effect, []); const handler = function self() { self.value = 1; }; handler(); return handler; }',
            'function Component() { useEffect(effect, []); const handler = function self() { mutate(self); }; handler(); return handler; }',
            'function Component() { useEffect(effect, []); const handler = function () { arguments.callee.value = 1; }; handler(); return handler; }',
            'function Component() { useEffect(effect, []); const value = object.getter; return value; }',
            'function Component() { useEffect(effect, []); const value = external + 1; return value; }',
            'function Component() { useEffect(effect, []); const value = 1n / 0n; return value; }',
            'function Component() { useEffect(effect, []); const value = /pattern/; return value; }',
            'function Component() { useEffect(effect, []); const value: number = read() as number; return value; }',
            'function Component() { useEffect(effect, []); const {value = read()} = input; return value; }',

            // A hook may invoke an earlier closure or a hoisted function that observes a TDZ.
            'function Component() { const read = () => value; useEffect(read, []); const value = 1; return value; }',
            'function Component() { useEffect(read, []); const value = 1; function read() { return value; } return value; }',
            'function Component() { const read = () => submit; const submit = () => 1; const state = useState(read); return state; }',
            'function Component() { useEffect(effect, []); const value = 1; const read = () => value; return read; }',
            'function Component() { log(value); useEffect(effect, []); const value = 1; return value; }',
            'function Component() { useEffect(effect, []); const value = 1; value = 2; return value; }',
            'function Component() { useEffect(effect, []); const value = 1; value++; return value; }',
            'function Component() { useEffect(effect, []); const value = 1; if (flag) { log(value); } return value; }',
            'function Component() { useEffect(effect, []); const value = 1; eval("value"); return value; }',
            'function Component() { useEffect(effect, []); const value = 1; (eval as Function)("value"); return value; }',
            'function Component() { useEffect(() => ((eval as <T>(s: string) => T)<number>)("value"), []); const value = 1; return value; }',
            'function Component() { const read = () => eval("value"); useEffect(read, []); const value = 1; return value; }',

            // Comments and suppression directives never change their attachment or target.
            'function Component() { useEffect(effect, []); /* value */ const value = 1; return value; }',
            'function Component() { useEffect(effect, []); const value = /* value */ 1; return value; }',
            'function Component() {\n useEffect(effect, []); // effect\n const value = 1;\n return value;\n}',
            'function Component() {\n useEffect(effect, []);\n const value = 1; // value\n return value;\n}',
            '/* eslint-disable no-console */ function Component() { useEffect(effect, []); const value = 1; return value; }',
            'function Component() {\n useEffect(effect, []);\n // eslint-disable-next-line no-console\n const value = 1;\n return value;\n}',
        ].map(code => ({code, output: null, errors: [{messageId: 'order'}]})),
        {
            code: 'function Component() { useEffect(effect, []); const value = 1; with (object) { log(value); } return value; }',
            languageOptions: {sourceType: 'script'},
            output: null,
            errors: [{messageId: 'order'}],
        },
    ],
});

const linter = new Linter();
const config = {
    languageOptions: {parser: tsParser},
    plugins: {expensify: {rules: {[rule.name]: rule}}},
    rules: {[`expensify/${rule.name}`]: 'warn'},
};

describe('component body autofix execution', () => {
    test.each(['', 'useEffect(effect, []); const value = 1;'])('preserves ASI at unchanged hook boundaries with prefix %s', (prefix) => {
        const code = `function Component() {
            ${prefix}
            const state = useState(0)
            const submit = () => 1;
            (useContext)(Context);
            return submit();
        }`;
        const result = linter.verifyAndFix(code, config);
        function execute(source) {
            const trace = [];
            const value = runInNewContext(`${source}; Component()`, {
                Context: {},
                effect() {},
                useEffect() {
                    trace.push('useEffect');
                },
                useState(initializer) {
                    trace.push('useState');
                    return initializer;
                },
                useContext() {
                    trace.push('useContext');
                },
            });
            return {value, trace};
        }
        expect(result.fixed).toBe(true);
        expect(result.output).toContain('const state = useState(0);');
        expect(execute(result.output)).toEqual(execute(code));
        expect(execute(result.output).value).toBe(1);
        expect(linter.verifyAndFix(result.output, config).fixed).toBe(false);
    });

    test('preserves the TDZ observed by direct eval through a TypeScript instantiation expression', () => {
        const code = `function Component() {
            useEffect(() => ((eval as <T>(s: string) => T)<number>)("value"), []);
            const value = 1;
            return value;
        }`;
        const result = linter.verifyAndFix(code, config);
        const context = {useEffect: callback => callback()};
        expect(result.fixed).toBe(false);
        expect(result.output).toBe(code);
        expect(() => runInNewContext(`${stripTypeScriptTypes(code)}; Component()`, context)).toThrow('before initialization');
        expect(() => runInNewContext(`${stripTypeScriptTypes(result.output)}; Component()`, context)).toThrow('before initialization');
    });

    test('preserves runtime effects and the order of hook calls', () => {
        const code = `function Component() {
            useEffect(() => trace.push('effect'), []);
            const submit = () => trace.push('submit');
            const value = 1 + 2;
            const state = useState(trace.push('initializer'));
            submit();
            return [value, state];
        }`;
        const result = linter.verifyAndFix(code, config);
        function execute(source) {
            const trace = [];
            const value = runInNewContext(`${source}; Component()`, {
                trace,
                useEffect(callback) {
                    trace.push('useEffect');
                    callback();
                },
                useState(initializer) {
                    trace.push('useState');
                    return initializer;
                },
            });
            return {trace, value: [...value]};
        }
        expect(result.fixed).toBe(true);
        expect(execute(result.output)).toEqual(execute(code));
        expect(execute(result.output).trace).toEqual(['useEffect', 'effect', 'initializer', 'useState', 'submit']);
        expect(linter.verifyAndFix(result.output, config).fixed).toBe(false);
    });

    test('does not separate allocation and mutation across a hook', () => {
        const code = `function Component() {
            const values = [];
            const state = useState(values.push('initializer'));
            values.push(state);
            return values;
        }`;
        const result = linter.verifyAndFix(code, config);
        expect(result.fixed).toBe(false);
        expect(result.output).toBe(code);
    });

    test('keeps function allocation and property mutation on the same side of an effect', () => {
        const code = `function Component() {
            useEffect(effect, []);
            const handler = () => 1;
            handler.value = trace.push('mutation');
            return handler;
        }`;
        const result = linter.verifyAndFix(code, config);
        function execute(source) {
            const trace = [];
            const handler = runInNewContext(`${source}; Component()`, {
                trace,
                effect() {},
                useEffect() {
                    trace.push('effect');
                },
            });
            return {trace, result: handler(), value: handler.value};
        }
        expect(result.fixed).toBe(false);
        expect(result.output).toBe(code);
        expect(execute(result.output)).toEqual(execute(code));
        expect(execute(result.output)).toEqual({trace: ['effect', 'mutation'], result: 1, value: 2});
    });

    test('preserves the TDZ observed by a hoisted callback', () => {
        const code = `function Component() {
            useEffect(read, []);
            const value = 1;
            function read() { return value; }
            return value;
        }`;
        const result = linter.verifyAndFix(code, config);
        expect(result.fixed).toBe(false);
        expect(() => runInNewContext(`${result.output}; Component()`, {useEffect: callback => callback()})).toThrow('before initialization');
    });

    test('does not evaluate callback defaults or captured mutable values during creation', () => {
        const code = `function Component() {
            useEffect(() => { state.value = 2; }, []);
            const submit = (value = read()) => value + state.value;
            return submit();
        }`;
        const result = linter.verifyAndFix(code, config);
        function execute(source) {
            const state = {value: 1};
            const trace = [];
            const value = runInNewContext(`${source}; Component()`, {
                state,
                useEffect(callback) {
                    trace.push('effect');
                    callback();
                },
                read() {
                    trace.push('default');
                    return state.value;
                },
            });
            return {value, trace};
        }
        expect(result.fixed).toBe(true);
        expect(execute(result.output)).toEqual(execute(code));
        expect(execute(result.output)).toEqual({value: 4, trace: ['effect', 'default']});
    });

    test('finishes more than ten movements in one fix without oscillating around hook anchors', () => {
        const handlers = Array.from({length: 16}, (unused, index) => `const submit${index} = () => ${index};`).join('\n');
        const values = Array.from({length: 16}, (unused, index) => `const value${index} = ${index};`).join('\n');
        const code = `function Component() { useEffect(effect, []); ${handlers}\n${values}\nconst state = useState(0); return state; }`;
        const messages = linter.verify(code, config);
        const firstFix = messages[0].fix;
        const once = code.slice(0, firstFix.range[0]) + firstFix.text + code.slice(firstFix.range[1]);
        expect(linter.verifyAndFix(once, config).fixed).toBe(false);
        expect(linter.verifyAndFix(code, config).output).toBe(once);
        expect(once.indexOf('value15')).toBeLessThan(once.indexOf('submit0'));
        expect(once.indexOf('submit15')).toBeLessThan(once.indexOf('useEffect'));
        expect(once.indexOf('useEffect')).toBeLessThan(once.indexOf('useState'));
    });
});
