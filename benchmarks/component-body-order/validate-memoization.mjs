/* eslint-disable rulesdir/prefer-underscore-method -- This standalone harness uses native collection methods. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {runInThisContext} from 'node:vm';
import {Linter} from 'eslint';
import tsParser from '@typescript-eslint/parser';

import * as rule from '../../eslint-plugin-expensify/component-body-order.js';
import {collectCompiledCalls, validateFooterOrdering} from './validate-footer-ordering.mjs';

const {values} = parseArgs({
    options: {
        app: {type: 'string'},
        footer: {type: 'boolean', default: false},
    },
});
assert.ok(values.app, 'Usage: node validate-memoization.mjs --app /path/to/App [--footer]');
const app = path.resolve(values.app);
const requireApp = createRequire(path.join(app, 'package.json'));
const React = requireApp('react');
const PropTypes = requireApp('prop-types');
const {act, create} = requireApp('react-test-renderer');
const {transformSync} = requireApp('oxc-transform-react');
const esbuild = requireApp('esbuild');
const config = requireApp(path.join(app, 'config/babel/oxcReactCompilerConfig.js'));
const {parse} = requireApp('@babel/parser');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function compile(source, filename = 'src/hooks/useOrderingProbe.ts') {
    const result = transformSync(filename, source, {
        lang: filename.endsWith('.tsx') ? 'tsx' : 'ts',
        reactCompiler: config(),
    });
    assert.equal(result.fatal, false, `${filename}: fatal transform`);
    assert.deepEqual(result.errors || [], [], `${filename}: compiler diagnostics`);
    assert.ok(result.code.includes('react/compiler-runtime'), `${filename}: missing compiler runtime`);
    return result.code;
}

const imports = `import {buildList, formatLabels, useThing} from './utils';
import {useEffect} from 'react';`;
const result = `    const countItems = () => list.length;
    return {list, labels, countItems};`;
const splitAllocation = `${imports}
export default function useOrderingProbe(items) {
    const labels = formatLabels(items);
    const list = buildList(items);
    useThing();
    list.push(1);
${result}
}`;
const joinedAllocation = splitAllocation.replace(
    '    const labels = formatLabels(items);\n    const list = buildList(items);\n    useThing();',
    '    useThing();\n    const labels = formatLabels(items);\n    const list = buildList(items);',
);
const cachedBeforeHook = splitAllocation.replace('    list.push(1);\n', '');
const cachedAfterHook = joinedAllocation.replace('    list.push(1);\n', '');
const handlerAfterEffect = `${imports}
export default function useOrderingProbe(items) {
    useThing();
    const labels = formatLabels(items);
    const list = buildList(items);
    useEffect(() => {}, []);
${result}
}`;
const handlerBeforeEffect = handlerAfterEffect.replace(
    '    useEffect(() => {}, []);\n    const countItems = () => list.length;',
    '    const countItems = () => list.length;\n    useEffect(() => {}, []);',
);

const linter = new Linter();
function orderingDiagnostics(source) {
    const diagnostics = linter.verify(source, [{
        files: ['**/*.ts'],
        languageOptions: {parser: tsParser, ecmaVersion: 'latest', sourceType: 'module'},
        plugins: {poc: {rules: {[rule.name]: rule}}},
        rules: {[`poc/${rule.name}`]: 'warn'},
    }], {filename: 'src/hooks/useOrderingProbe.ts'});
    assert.ok(diagnostics.every(diagnostic => diagnostic.ruleId === `poc/${rule.name}` && diagnostic.messageId === 'order'), 'Unexpected lint diagnostic');
    return diagnostics.map(({messageId, message}) => ({messageId, message}));
}

async function measure(source, expectedBuilds, expectedIdentity, append) {
    const code = compile(source);
    const compiler = collectCompiledCalls(code, parse, 'useOrderingProbe');
    assert.deepEqual(compiler.calls.buildList, expectedBuilds === 1 ? {guarded: 1, unguarded: 0} : {guarded: 0, unguarded: 1});
    const counters = {buildList: 0, formatLabels: 0};
    const utils = {
        buildList(items) {
            counters.buildList += 1;
            return items.slice();
        },
        formatLabels(items) {
            counters.formatLabels += 1;
            return items.join(',');
        },
        useThing() {
            return React.useState(0);
        },
    };
    const module = {exports: {}};
    const lowered = esbuild.transformSync(code, {format: 'cjs'}).code;
    runInThisContext(`(function(require, module, exports) {\n${lowered}\n})`)(
        id => (id === './utils' ? utils : requireApp(id)),
        module,
        module.exports,
    );
    const useOrderingProbe = module.exports.default;
    let current;
    let renders = 0;
    function Probe({items, tick}) {
        renders += 1;
        current = useOrderingProbe(items);
        return React.createElement('span', null, `${tick}:${current.list.join(',')}:${current.labels}:${current.countItems()}`);
    }
    Probe.propTypes = {
        items: PropTypes.arrayOf(PropTypes.number).isRequired,
        tick: PropTypes.number.isRequired,
    };
    const expectedList = items => (append ? [...items, 1] : items);
    function check(root, items, tick) {
        assert.deepEqual(current.list, expectedList(items));
        assert.equal(current.labels, items.join(','));
        assert.equal(current.countItems(), expectedList(items).length);
        assert.deepEqual(root.toJSON().children, [`${tick}:${expectedList(items).join(',')}:${items.join(',')}:${expectedList(items).length}`]);
    }
    const items = Object.freeze([2, 3]);
    let root;
    try {
        await act(() => {
            root = create(React.createElement(Probe, {items, tick: 0}));
        });
        const first = current;
        check(root, items, 0);
        async function unrelatedRender(tick) {
            await act(() => root.update(React.createElement(Probe, {items, tick})));
            check(root, items, tick);
            assert.equal(current === first, expectedIdentity, 'Returned object identity');
            assert.equal(current.list === first.list, expectedIdentity, 'Derived allocation identity');
            assert.equal(current.countItems === first.countItems, expectedIdentity, 'Handler identity');
            if (tick < 5) {
                await unrelatedRender(tick + 1);
            }
        }
        await unrelatedRender(1);
        assert.equal(renders, 6, 'Probe must actually rerender five times');
        assert.deepEqual(counters, {buildList: expectedBuilds, formatLabels: 1});
        const unrelated = {...counters};
        const previous = current;
        const changedItems = Object.freeze([4, 5]);
        await act(() => root.update(React.createElement(Probe, {items: changedItems, tick: 6})));
        check(root, changedItems, 6);
        assert.equal(renders, 7);
        assert.deepEqual(counters, {buildList: expectedBuilds + 1, formatLabels: 2});
        assert.notEqual(current, previous);
        assert.notEqual(current.list, previous.list);
        assert.notEqual(current.countItems, previous.countItems);
        return {
            unrelated,
            changedInput: {...counters},
            stableObjectAndHandler: expectedIdentity,
            compilerBuildList: compiler.calls.buildList,
            hooks: compiler.hooks,
        };
    } finally {
        if (root) {
            await act(() => root.unmount());
        }
    }
}

const cases = [
    {
        name: 'join-allocation-after-hook',
        before: splitAllocation,
        after: joinedAllocation,
        builds: [6, 1],
        identity: [false, true],
        append: true,
        ordering: ['inputs/context before derived values', null],
        ruleRecommended: true,
    },
    {
        name: 'negative-already-cached',
        before: cachedBeforeHook,
        after: cachedAfterHook,
        builds: [1, 1],
        identity: [true, true],
        append: false,
        ordering: ['inputs/context before derived values', null],
        ruleRecommended: true,
    },
    {
        name: 'neutral-handler-before-effect',
        before: handlerAfterEffect,
        after: handlerBeforeEffect,
        builds: [1, 1],
        identity: [true, true],
        append: false,
        ordering: ['handlers before effects', null],
        ruleRecommended: true,
    },
    {
        name: 'harmful-allocation-split',
        before: joinedAllocation,
        after: splitAllocation,
        builds: [1, 6],
        identity: [true, false],
        append: true,
        ordering: [null, 'inputs/context before derived values'],
        ruleRecommended: false,
    },
];
const report = {
    node: process.version,
    eslint: createRequire(import.meta.url)('eslint/package.json').version,
    versions: Object.fromEntries(['oxc-transform-react', 'react', 'react-test-renderer', 'esbuild'].map(name => [name, requireApp(`${name}/package.json`).version])),
    compilerConfig: config(),
    runtime: [],
};
await cases.reduce(async (previousCase, fixture) => {
    await previousCase;
    const diagnostics = [orderingDiagnostics(fixture.before), orderingDiagnostics(fixture.after)];
    for (let index = 0; index < diagnostics.length; index += 1) {
        const expected = fixture.ordering[index];
        assert.equal(diagnostics[index].length, expected ? 1 : 0, `${fixture.name}: ordering diagnostic count`);
        if (expected) {
            assert.ok(diagnostics[index][0].message.includes(expected), `${fixture.name}: expected ${expected}`);
        }
    }
    const entry = {
        name: fixture.name,
        ruleRecommended: fixture.ruleRecommended,
        orderingDiagnostics: diagnostics,
        before: await measure(fixture.before, fixture.builds[0], fixture.identity[0], fixture.append),
        after: await measure(fixture.after, fixture.builds[1], fixture.identity[1], fixture.append),
    };
    assert.deepEqual(entry.after.hooks, entry.before.hooks, `${fixture.name}: hook sequence changed`);
    report.runtime.push(entry);
}, Promise.resolve());
if (values.footer) {
    report.footer = validateFooterOrdering({app, requireApp, compile});
}
// eslint-disable-next-line no-console -- JSON is this validation CLI's output.
console.log(JSON.stringify(report, null, 4));
