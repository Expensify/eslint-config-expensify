/* eslint-disable no-console, no-await-in-loop, rulesdir/prefer-underscore-method -- Sequential compiler experiments use native collections and print a research report. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {runInThisContext} from 'node:vm';
import {Linter} from 'eslint';
import tsParser from '@typescript-eslint/parser';
import * as rule from '../../eslint-plugin-expensify/component-body-order.js';
import {collectCompiledCalls} from './validate-footer-ordering.mjs';

const {values} = parseArgs({
    options: {
        app: {type: 'string'},
        output: {type: 'string'},
        summary: {type: 'string'},
    },
});
assert(values.app, 'Pass --app /path/to/App');
const app = path.resolve(values.app);
const requireApp = createRequire(path.join(app, 'package.json'));
const React = requireApp('react');
const PropTypes = requireApp('prop-types');
const {act, create} = requireApp('react-test-renderer');
const {transformSync} = requireApp('oxc-transform-react');
const esbuild = requireApp('esbuild');
const parse = requireApp('@typescript-eslint/parser').parse;
const config = requireApp(path.join(app, 'config/babel/oxcReactCompilerConfig.js'));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function source(body, returned = '{a, b}') {
    return `import {useEffect, useState} from 'react';
import {buildA, buildB, cheap, expensive, observe} from './operations';
export default function useSchedulingProbe({inputA, inputB, visible}) {
${body}
return ${returned};
}`;
}

function compilerOptions(engine) {
    if (engine === 'uncompiled') {
        return false;
    }
    const options = config();
    if (engine !== 'uncompiled') {
        options.reportDiagnostics = true;
    }
    return options;
}

function compile(text, engine) {
    const filename = 'src/hooks/useSchedulingProbe.ts';
    const result = transformSync(filename, text, {lang: 'ts', reactCompiler: compilerOptions(engine)});
    assert.equal(result.fatal, false);
    assert.deepEqual(result.errors, [], 'OXC compiler diagnostics');
    return result.code;
}

const a0 = Object.freeze([2, 3]);
const a1 = Object.freeze([7, 8]);
const a2 = Object.freeze([11, 12]);
const b0 = Object.freeze([4, 5]);
const b1 = Object.freeze([9, 10]);
const b2 = Object.freeze([13, 14]);
const updates = [
    {label: 'mount', inputA: a0, inputB: b0},
    {label: 'stable', inputA: a0, inputB: b0},
    {label: 'onlyA', inputA: a1, inputB: b0},
    {label: 'stableA', inputA: a1, inputB: b0},
    {label: 'onlyB', inputA: a1, inputB: b1},
    {label: 'stableAB', inputA: a1, inputB: b1},
    {label: 'both', inputA: a2, inputB: b2},
    {label: 'stableBoth', inputA: a2, inputB: b2},
    {label: 'onlyBRevert', inputA: a2, inputB: b1},
];

async function measure(text, engine, sequence, expectedValue, expectedHooks = ['useEffect'], hasDependentEffect = false) {
    const code = compile(text, engine);
    assert.equal(code.includes('react/compiler-runtime'), engine !== 'uncompiled', `${engine}: compiler eligibility`);
    const counters = {
        buildA: 0, buildB: 0, cheap: 0, expensive: 0,
    };
    const cacheAccesses = {reads: 0, writes: 0};
    const lifecycle = [];
    const operations = {
        buildA(items) {
            counters.buildA += 1;
            return items.slice();
        },
        buildB(items) {
            counters.buildB += 1;
            return items.slice();
        },
        cheap(items) {
            counters.cheap += 1;
            return items.length > 0;
        },
        expensive(items) {
            counters.expensive += 1;
            if (typeof items === 'boolean') {
                return items ? 'positive' : 'empty';
            }
            return items.reduce((sum, item) => sum + item, 0);
        },
        observe(event) {
            lifecycle.push(event);
        },
    };
    const module = {exports: {}};
    const lowered = esbuild.transformSync(code, {format: 'cjs'}).code;
    const runtime = requireApp('react/compiler-runtime');
    const observedRuntime = {
        ...runtime,
        c(size) {
            return new Proxy(runtime.c(size), {
                get(target, key) {
                    if (typeof key === 'string' && /^\d+$/.test(key)) {
                        cacheAccesses.reads += 1;
                    }
                    return Reflect.get(target, key);
                },
                set(target, key, value) {
                    if (typeof key === 'string' && /^\d+$/.test(key)) {
                        cacheAccesses.writes += 1;
                    }
                    return Reflect.set(target, key, value);
                },
            });
        },
    };
    const evaluate = runInThisContext(`(function(require, module, exports) {\n${lowered}\n})`);
    evaluate((id) => {
        if (id === './operations') {
            return operations;
        }
        return id === 'react/compiler-runtime' ? observedRuntime : requireApp(id);
    }, module, module.exports);
    let current;
    let renders = 0;
    function Probe(props) {
        renders += 1;
        current = module.exports.default(props);
        return React.createElement('span', null, `${props.tick}:${JSON.stringify(current)}`);
    }
    Probe.propTypes = {tick: PropTypes.number.isRequired};
    let root;
    async function render(input, tick) {
        await act(() => {
            const element = React.createElement(Probe, {...input, tick});
            if (root) {
                root.update(element);
            } else {
                root = create(element);
            }
        });
    }
    const samples = [];
    const expectedLifecycle = [];
    try {
        for (let tick = 0; tick < sequence.length; tick++) {
            const input = sequence[tick];
            const previous = current;
            const previousA = previous && 'a' in previous ? previous.a.join(',') : null;
            const previousCounters = {...counters};
            const previousAccesses = {...cacheAccesses};
            await render(input, tick);
            assert.deepEqual(current, expectedValue(input), `${engine}: ${input.label} value`);
            if ('a' in current && 'b' in current) {
                assert.notEqual(current.a, current.b, 'Independent allocations must remain distinct');
                if (tick > 0) {
                    assert.equal(current.a === previous.a, counters.buildA === previousCounters.buildA, 'A allocation identity');
                    assert.equal(current.b === previous.b, counters.buildB === previousCounters.buildB, 'B allocation identity');
                    const expectedStableResult = engine !== 'uncompiled' && current.a === previous.a && current.b === previous.b;
                    assert.equal(current === previous, expectedStableResult, 'Returned object identity');
                }
            }
            assert.deepEqual(root.toJSON().children, [`${tick}:${JSON.stringify(expectedValue(input))}`]);
            if (hasDependentEffect) {
                if (tick === 0) {
                    expectedLifecycle.push(`setup:${current.a.join(',')}`);
                } else if (current.a !== previous.a) {
                    expectedLifecycle.push(`cleanup:${previousA}`, `setup:${current.a.join(',')}`);
                }
                assert.deepEqual(lifecycle, expectedLifecycle, 'Effect values and timing after each commit');
            } else {
                assert.deepEqual(lifecycle, ['setup'], 'Unrelated effect must run exactly once after mount');
            }
            samples.push({
                label: input.label,
                calls: {...counters},
                sameA: 'a' in current ? tick > 0 && current.a === previous.a : null,
                sameB: 'b' in current ? tick > 0 && current.b === previous.b : null,
                sameResult: tick > 0 && current === previous,
                cacheAccesses: {reads: cacheAccesses.reads - previousAccesses.reads, writes: cacheAccesses.writes - previousAccesses.writes},
            });
        }
        assert.equal(renders, sequence.length);
    } finally {
        if (root) {
            await act(() => root.unmount());
        }
    }
    if (hasDependentEffect) {
        expectedLifecycle.push(`cleanup:${current.a.join(',')}`);
        assert.deepEqual(lifecycle, expectedLifecycle, 'Unmount cleanup must capture the last committed array');
    } else {
        assert.deepEqual(lifecycle, ['setup', 'cleanup'], 'Effect lifecycle must be preserved');
    }
    const analysis = collectCompiledCalls(code, parse, 'useSchedulingProbe');
    assert.deepEqual(analysis.hooks, expectedHooks, 'Hook sequence must be preserved');
    const cacheSize = code.match(/\b_c\((\d+)\)/);
    assert.equal(!!cacheSize, engine !== 'uncompiled');
    return {
        samples,
        lifecycle,
        guards: Object.fromEntries(['buildA', 'buildB', 'cheap', 'expensive'].filter(name => analysis.calls[name]).map(name => [name, analysis.calls[name]])),
        cacheSlots: cacheSize ? Number(cacheSize[1]) : 0,
        compiledBytes: Buffer.byteLength(code),
    };
}

function permutations(items) {
    if (items.length === 0) {
        return [[]];
    }
    return items.flatMap((item, index) => permutations(items.filter((value, otherIndex) => otherIndex !== index)).map(rest => [item, ...rest]));
}

const effect = 'useEffect(() => { observe("setup"); return () => observe("cleanup"); }, []);';
const statements = {
    A: 'const a = buildA(inputA);',
    a: 'a.push(1);',
    B: 'const b = buildB(inputB);',
    b: 'b.push(2);',
    E: effect,
};
const schedules = permutations(Object.keys(statements)).filter(order => order.indexOf('A') < order.indexOf('a') && order.indexOf('B') < order.indexOf('b'));
assert.equal(schedules.length, 30);
const expectedArrays = ({inputA, inputB}) => ({a: [...inputA, 1], b: [...inputB, 2]});
const report = {
    node: process.version,
    versions: Object.fromEntries(['oxc-transform-react', 'react', 'react-test-renderer', 'esbuild']
        .map(name => [name, requireApp(`${name}/package.json`).version])),
    compilerConfig: config(),
    legend: {
        A: 'allocate a', a: 'mutate a', B: 'allocate b', b: 'mutate b', E: 'register effect',
    },
    updateLabels: updates.map(update => update.label),
    engines: {},
};
const linter = new Linter();
function lintSchedule(order) {
    const diagnostics = linter.verify(source([...order].map(token => statements[token]).join('\n')), [{
        files: ['**/*.ts'],
        languageOptions: {parser: tsParser},
        plugins: {poc: {rules: {[rule.name]: rule}}},
        rules: {[`poc/${rule.name}`]: 'warn'},
    }], {filename: 'useSchedulingProbe.ts'});
    assert(diagnostics.every(diagnostic => diagnostic.ruleId === `poc/${rule.name}` && diagnostic.messageId === 'order'));
    return diagnostics.map(({message}) => message);
}
report.ruleCounterexample = {
    beforeSchedule: 'EAaBb',
    afterSchedule: 'AEaBb',
    beforeDiagnostics: lintSchedule('EAaBb'),
    afterDiagnostics: lintSchedule('AEaBb'),
};
assert.equal(report.ruleCounterexample.beforeDiagnostics.length, 1);
assert(report.ruleCounterexample.beforeDiagnostics[0].includes('derived values before effects'));
assert.deepEqual(report.ruleCounterexample.afterDiagnostics, []);

for (const engine of ['uncompiled', 'oxc']) {
    const results = {};
    for (const order of schedules) {
        const text = source(order.map(token => statements[token]).join('\n'));
        results[order.join('')] = await measure(text, engine, updates, expectedArrays);
    }
    const reference = results.AaBbE;
    assert.deepEqual(reference.samples.map(sample => sample.calls.buildA), engine === 'uncompiled' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 1, 2, 2, 2, 2, 3, 3, 3]);
    assert.deepEqual(reference.samples.map(sample => sample.calls.buildB), engine === 'uncompiled' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 1, 1, 1, 2, 2, 3, 3, 4]);
    const sameHelperCallCountsAsGrouped = Object.entries(results).filter(([, result]) => result.samples.every((sample, index) => (
        sample.calls.buildA === reference.samples[index].calls.buildA && sample.calls.buildB === reference.samples[index].calls.buildB
    ))).map(([order]) => order);
    report.engines[engine] = {compilerOptions: compilerOptions(engine), sameHelperCallCountsAsGrouped, schedules: results};

    // Same calculations and hook sequence; the branch determines whether the result is demanded.
    const demandUpdates = [
        {label: 'hidden-mount', inputA: a0, visible: false},
        {label: 'hidden-new-input', inputA: a1, visible: false},
        {label: 'show', inputA: a1, visible: true},
        {label: 'visible-stable', inputA: a1, visible: true},
        {label: 'hide-new-input', inputA: a2, visible: false},
        {label: 'show-new-input', inputA: a2, visible: true},
    ];
    const demanded = source(`${effect}\nif (!visible) { return {value: null}; }\nconst value = expensive(inputA);`, '{value}');
    const hoisted = source(`${effect}\nconst value = expensive(inputA);\nif (!visible) { return {value: null}; }`, '{value}');
    const expectedDemand = ({inputA, visible}) => ({value: visible ? inputA.reduce((sum, item) => sum + item, 0) : null});
    report.engines[engine].demand = {
        guarded: await measure(demanded, engine, demandUpdates, expectedDemand),
        hoisted: await measure(hoisted, engine, demandUpdates, expectedDemand),
    };

    // A hook needs the constructed value's length; mere reordering cannot put all construction on one side of it.
    const spanning = source(`const a = buildA(inputA);\nconst [count] = useState(a.length);\na.push(count);\n${effect}`, '{a}');
    const persistentInput = source(`const prepared = buildA(inputA);\nconst [count] = useState(prepared.length);\nconst a = [...prepared, count];\n${effect}`, '{a}');
    const stateUpdates = [...updates, {label: 'differentLength', inputA: Object.freeze([15, 16, 17]), inputB: b1}];
    const expectedState = ({inputA}) => ({a: [...inputA, a0.length]});
    report.engines[engine].hookDependency = {
        mutation: await measure(spanning, engine, stateUpdates, expectedState, ['useState', 'useEffect']),
        immutableResult: await measure(persistentInput, engine, stateUpdates, expectedState, ['useState', 'useEffect']),
    };
    assert.equal(report.engines[engine].hookDependency.mutation.samples.at(-1).calls.buildA, stateUpdates.length);

    const dependentEffect = 'useEffect(() => { observe("setup:" + a.join(",")); return () => observe("cleanup:" + a.join(",")); }, [a]);';
    report.engines[engine].effectIdentity = {};
    for (const [name, order] of Object.entries({grouped: 'AaBb', interleaved: 'ABab'})) {
        const text = source(`${[...order].map(token => statements[token]).join('\n')}\n${dependentEffect}`);
        const result = await measure(text, engine, updates, expectedArrays, ['useEffect'], true);
        const setups = result.lifecycle.filter(event => event.startsWith('setup:'));
        const cleanups = result.lifecycle.filter(event => event.startsWith('cleanup:'));
        assert.deepEqual(cleanups, setups.map(event => event.replace('setup:', 'cleanup:')));
        const expectedSetups = name === 'grouped' ? 3 : 5;
        assert.equal(setups.length, engine === 'uncompiled' ? updates.length : expectedSetups);
        report.engines[engine].effectIdentity[name] = result;
    }

    const empty = Object.freeze([]);
    const primitiveUpdates = [...updates,
        {label: 'empty', inputA: empty},
        {label: 'empty-stable', inputA: empty},
        {label: 'nonempty-again', inputA: a2},
    ];
    const opaque = source(`${effect}\nconst intermediate = cheap(inputA);\nconst value = expensive(intermediate);`, '{value}');
    const primitive = source(`${effect}\nconst intermediate = !!cheap(inputA);\nconst value = expensive(intermediate);`, '{value}');
    const expectedPrimitive = ({inputA}) => ({value: inputA.length > 0 ? 'positive' : 'empty'});
    report.engines[engine].primitiveBoundary = {
        opaque: await measure(opaque, engine, primitiveUpdates, expectedPrimitive),
        primitive: await measure(primitive, engine, primitiveUpdates, expectedPrimitive),
    };
}

if (values.output) {
    fs.writeFileSync(values.output, `${JSON.stringify(report, null, 4)}\n`);
}
const measurements = Object.values(report.engines).flatMap(engine => [
    ...Object.values(engine.schedules), ...Object.values(engine.demand), ...Object.values(engine.hookDependency),
    ...Object.values(engine.effectIdentity), ...Object.values(engine.primitiveBoundary),
]);
const summary = {
    node: report.node,
    versions: report.versions,
    compilerConfig: report.compilerConfig,
    updateLabels: report.updateLabels,
    measurements: measurements.length,
    renders: measurements.reduce((sum, measurement) => sum + measurement.samples.length, 0),
    ruleCounterexample: {
        ...report.ruleCounterexample,
        beforeBuildACalls: report.engines.oxc.schedules.EAaBb.samples.at(-1).calls.buildA,
        afterBuildACalls: report.engines.oxc.schedules.AEaBb.samples.at(-1).calls.buildA,
    },
    engines: Object.fromEntries(Object.entries(report.engines).map(([engine, result]) => [engine, {
        schedules: Object.keys(result.schedules).length,
        compilerOptions: result.compilerOptions,
        sameHelperCallCountsAsGrouped: result.sameHelperCallCountsAsGrouped,
        groupedTotalCalls: result.schedules.AaBbE.samples.at(-1).calls,
        interleavedTotalCalls: result.schedules.ABabE.samples.at(-1).calls,
        splitTotalCalls: result.schedules.AEBab.samples.at(-1).calls,
        bothChangeCacheReads: {
            grouped: result.schedules.AaBbE.samples.find(sample => sample.label === 'both').cacheAccesses.reads,
            interleaved: result.schedules.ABabE.samples.find(sample => sample.label === 'both').cacheAccesses.reads,
        },
        demandTotalCalls: {
            guarded: result.demand.guarded.samples.at(-1).calls.expensive,
            hoisted: result.demand.hoisted.samples.at(-1).calls.expensive,
        },
        hookDependencyCalls: {
            mutation: result.hookDependency.mutation.samples.at(-1).calls.buildA,
            immutableResult: result.hookDependency.immutableResult.samples.at(-1).calls.buildA,
        },
        effectSetupCounts: {
            grouped: result.effectIdentity.grouped.lifecycle.length / 2,
            interleaved: result.effectIdentity.interleaved.lifecycle.length / 2,
        },
        primitiveBoundaryCalls: {
            opaque: result.primitiveBoundary.opaque.samples.at(-1).calls,
            primitive: result.primitiveBoundary.primitive.samples.at(-1).calls,
        },
    }])),
};
if (values.summary) {
    fs.writeFileSync(values.summary, `${JSON.stringify(summary, null, 4)}\n`);
}
console.log(JSON.stringify(summary, null, 4));
