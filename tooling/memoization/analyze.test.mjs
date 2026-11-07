/* eslint-disable rulesdir/prefer-underscore-method -- Assertions inspect native arrays from the reporter. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test as nodeTest} from 'node:test';
import {fileURLToPath} from 'node:url';
import {analyzeSource, loadEngines} from './analyze.mjs';

const app = process.env.MEMOIZATION_APP || fileURLToPath(new URL('../../../App/', import.meta.url));
const engines = loadEngines(app);
const imports = `import {useEffect, useState, use} from 'react';
import {build} from './operations';`;
const crossing = `const a = build(x);
    useEffect(() => {}, []);
    a.push(1);
    return a;`;

function analyze(body) {
    return analyzeSource(`${imports}\nexport function useProbe(x) {\n    ${body}\n}`, 'probe.ts', engines);
}

nodeTest('reports the specific hook-crossing scope and original locations, but not the intact construction', () => {
    const report = analyze(crossing);
    assert.equal(report.babel.status, 'compiled');
    assert.equal(report.babel.findings.length, 1);
    const [finding] = report.babel.findings;
    assert.equal(finding.function.name, 'useProbe');
    assert.equal(finding.pass, 'FlattenScopesWithHooksOrUseHIR');
    assert.deepEqual(finding.values.map(value => value.name), ['a']);
    assert.deepEqual(finding.hooks.map(hook => hook.name), ['useEffect']);
    assert.equal(finding.values[0].location.start.line, 4);
    assert.equal(finding.hooks[0].location.start.line, 5);
    assert.equal(finding.hooks[0].location.start.column, 4);
    assert.equal(report.oxc.status, 'compiled-output');
    assert.deepEqual(report.oxc.diagnostics, []);
    assert.equal(report.oxc.memoRuntimeImportAdded, true);
    assert.deepEqual(analyze('const a = build(x); a.push(1); useEffect(() => {}, []); return a;').babel.findings, []);
    assert.doesNotThrow(() => JSON.stringify(report));
});

nodeTest('preserves TSX wrapper names and source offsets across branch mutation', () => {
    const source = `import {memo, useEffect} from 'react';
import {build} from './operations';
export const Panel = memo(({x, flag}: {x: number[], flag: boolean}) => {
    const items = (build(x) as number[]);
    useEffect(() => {}, []);
    if (flag) { items.push(1); } else { items.push(2); }
    return <div>{items.length}</div>;
});`;
    const result = analyzeSource(source, 'Panel.tsx', engines);
    assert.equal(result.babel.status, 'compiled');
    assert.equal(result.babel.findings.length, 1);
    const [finding] = result.babel.findings;
    assert.equal(finding.function.name, 'Panel');
    assert.deepEqual(finding.values.map(value => value.name), ['items']);
    const {start, end} = finding.hooks[0].location;
    assert.equal(source.slice(start.index, end.index), 'useEffect(() => {}, [])');
    assert.equal(start.line, 5);
    assert.equal(result.oxc.status, 'compiled-output');
});

nodeTest('ignores ordinary hook-call scopes, named hook returns, and hook default wrappers', () => {
    const source = `import {useContext, useState} from 'react';
import {useThing, Context} from './hooks';
export function useDirect() { const value = useThing(); return value; }
export function useDefault() { const value = useThing() ?? []; return value; }
export function useArguments() { const value = useThing({enabled: true}); return value; }
export function Panel() {
    const theme = useContext(Context);
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount(count + 1)}>{theme.name}: {count}</button>;
}`;
    const result = analyzeSource(source, 'ordinary.tsx', engines);
    assert.equal(result.babel.status, 'compiled');
    assert.equal(result.babel.functions.length, 4);
    assert.deepEqual(result.babel.findings, []);
    assert.ok(result.babel.ignoredHookPrunedScopes > 0);
    assert.equal(result.oxc.status, 'compiled-output');
});

nodeTest('retains mutable default construction crossing a hook and identifies both sides', () => {
    const result = analyze('const a = build(x) ?? []; useEffect(() => {}, []); a.push(1); return a;');
    assert.equal(result.babel.status, 'compiled');
    assert.equal(result.babel.findings.length, 1);
    const [finding] = result.babel.findings;
    assert.ok(finding.values.some(value => value.name === 'a'));
    assert.ok(finding.constructions.some(construction => construction.instructionId < finding.hooks[0].instructionId));
    assert.ok(finding.continuations.some(continuation => continuation.instructionId > finding.hooks[0].instructionId));
});

nodeTest('keeps function-local scope IDs separate and does not attribute callback contents to render', () => {
    const source = `${imports}
export function useFirst(x) { ${crossing} }
export function useSecond(x) { ${crossing.replaceAll('a', 'items')} }
export function useCallbackOnly(x) {
    const callback = () => { const items = build(x); items.push(1); return items; };
    useEffect(() => {}, []);
    return callback;
}`;
    const report = analyzeSource(source, 'nested.js', engines);
    assert.equal(report.babel.status, 'compiled');
    assert.deepEqual(report.babel.findings.map(finding => finding.function.name), ['useFirst', 'useSecond']);
    assert.deepEqual(report.babel.findings.map(finding => finding.values[0].name), ['a', 'items']);
});

nodeTest('does not report opt-out debug IR as a compiled opportunity', () => {
    const result = analyze(`'use no memo'; ${crossing}`);
    assert.equal(result.babel.status, 'skipped-or-ineligible');
    assert.ok(result.babel.diagnostics.some(diagnostic => diagnostic.kind === 'CompileSkip'));
    assert.deepEqual(result.babel.findings, []);
    assert.ok(result.babel.unconfirmedScopeChanges.length > 0);
    assert.equal(result.oxc.memoRuntimeImportAdded, false);
    assert.equal(result.oxc.status, 'unchanged');
});

nodeTest('surfaces recoverable compiler bailouts independently from both engines', () => {
    const result = analyze('const a = build(x); if (x.length) { useEffect(() => {}, []); } a.push(1); return a;');
    assert.equal(result.babel.status, 'diagnostics');
    assert.ok(result.babel.diagnostics.some(diagnostic => diagnostic.kind === 'CompileError'));
    assert.deepEqual(result.babel.findings, []);
    assert.equal(result.oxc.status, 'diagnostics');
    assert.ok(result.oxc.diagnostics.length > 0);
    assert.equal(result.oxc.fatal, false);
});

nodeTest('does not conflate loop pruning or nested hook errors with hook-crossing evidence', () => {
    assert.deepEqual(analyze('const a = build(x); for (const v of x) { a.push(v); } useEffect(() => {}, []); return a;').babel.findings, []);
    const invalid = analyze('const callback = () => { useEffect(() => {}, []); }; useEffect(() => {}, []); return callback;');
    assert.equal(invalid.babel.status, 'diagnostics');
    assert.deepEqual(invalid.babel.findings, []);
});

nodeTest('recognizes hook dependencies and use without promising a legal movement', () => {
    const dependent = analyze('const a = build(x); const [count] = useState(a.length); a.push(count); return a;');
    assert.deepEqual(dependent.babel.findings[0].hooks.map(hook => hook.kind), ['useState']);
    const useResult = analyze('"use memo"; const a = build(x); const value = use(x); a.push(value); return a;');
    assert.equal(useResult.babel.status, 'compiled');
    assert.deepEqual(useResult.babel.findings[0].hooks.map(hook => hook.kind), ['use']);
});

nodeTest('returns both parse failures and handles explicitly ineligible JavaScript', () => {
    const broken = analyzeSource('export function {', 'broken.js', engines);
    assert.equal(broken.babel.status, 'failed');
    assert.equal(broken.oxc.status, 'failed');
    const plain = analyzeSource('export const value = 1;', 'plain.js', engines);
    assert.equal(plain.babel.status, 'skipped-or-ineligible');
    assert.equal(plain.oxc.status, 'unchanged');
    assert.deepEqual(plain.babel.findings, []);
    assert.throws(() => analyzeSource('', 'not-source.json', engines), /Unsupported input extension/);
});

nodeTest('CLI emits deterministic JSON, reads without changing inputs, and reports missing files', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'memoization-test-'));
    try {
        const first = path.join(directory, 'a.ts');
        const second = path.join(directory, 'b.jsx');
        const text = `${imports}\nexport function useProbe(x) { ${crossing} }`;
        fs.writeFileSync(first, text);
        fs.writeFileSync(second, text);
        const cli = fileURLToPath(new URL('./report.mjs', import.meta.url));
        const run = (...files) => spawnSync(process.execPath, [cli, '--app', app, '--json', '--', ...files], {encoding: 'utf8'});
        const result = run(second, first, first);
        assert.equal(result.status, 0, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.versions.babelCompiler, '1.0.0');
        assert.equal(report.versions.oxc, engines.versions.oxc);
        assert.deepEqual(report.files.map(file => file.filename), [first, second]);
        assert.equal(result.stdout, run(first, second).stdout);
        assert.equal(fs.readFileSync(first, 'utf8'), text);
        assert.equal(fs.readFileSync(second, 'utf8'), text);
        const failed = run(path.join(directory, 'missing.ts'));
        assert.equal(failed.status, 1);
        assert.match(JSON.parse(failed.stdout).files[0].failure, /ENOENT/);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});
