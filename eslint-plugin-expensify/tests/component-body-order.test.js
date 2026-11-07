/* eslint-disable rulesdir/prefer-underscore-method */
import {RuleTester} from 'eslint';
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
            output: null,
        },
        {
            code: 'function Component() { function submit() {} const value: number = derive(); return value; }',
            errors: [{messageId: 'order'}],
            output: null,
        },
        {
            code: 'function Component() { useEffect(effect, []); const value = 1; const state = useState(0); return [value, state]; }',
            errors: [{messageId: 'order', data: {group: 'derived values', previous: 'effects'}}],
            output: null,
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
            'function Component() { useEffect(effect, []); const submit = () => useSomething(); return submit; }',
        ].map(code => ({code, errors: [{messageId: 'order', suggestions: []}], output: null})),
    ],
});
