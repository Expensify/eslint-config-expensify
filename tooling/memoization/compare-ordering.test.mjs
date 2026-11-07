/* eslint-disable rulesdir/prefer-underscore-method -- Tests inspect native arrays. */
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {loadEngines} from './analyze.mjs';
import {compareSources, compareWorktree, inspectCode} from './compare-ordering.mjs';

const app = process.env.MEMOIZATION_APP || fileURLToPath(new URL('../../../App/', import.meta.url));
const engines = loadEngines(app);
const prefix = 'import {useEffect, useState} from "react"; import {build} from "./ops";';
const source = body => `${prefix} export function useProbe(x) { ${body} }`;

test('native OXC comparison detects newly guarded calls and preserves the direct hook sequence', () => {
    const before = source('const a = build(x); useEffect(() => {}, []); a.push(1); return a;');
    const after = source('useEffect(() => {}, []); const a = build(x); a.push(1); return a;');
    const result = compareSources(before, after, 'src/useProbe.ts', engines);
    assert.equal(result.before.status, 'cached-output');
    assert.equal(result.after.status, 'cached-output');
    assert.deepEqual(result.before.diagnostics, []);
    assert.deepEqual(result.after.diagnostics, []);
    assert.equal(result.sourceHookSequencesEqual, true);
    assert.equal(result.exactEmittedOutputEqual, false);
    assert.ok(result.emittedFunctionChanges[0].callChanges.some(call => call.name === 'build' && call.unguardedDelta === -1 && call.guardedDelta === 1));
    assert.ok(result.after.emitted.cacheSlots > 0);
    assert.ok(result.after.compiledMarkers.addedRuntimeImport);
    const regression = compareSources(after, before, 'src/useProbe.ts', engines);
    assert.ok(regression.warnings.some(warning => warning.kind === 'added-unguarded-call' && warning.call === 'build'));
});

test('exact equality is unnormalized output equality, with failures never marked equal', () => {
    const input = source('const [value] = useState(x); return value;');
    const result = compareSources(input, input, 'src/useProbe.ts', engines);
    assert.equal(result.exactEmittedOutputEqual, true);
    assert.equal(result.before.emittedHash, result.after.emittedHash);
    const invalid = compareSources('export function {', 'export function {', 'src/invalid.ts', engines);
    assert.equal(invalid.before.status, 'failed');
    assert.equal(invalid.exactEmittedOutputEqual, null);
    assert.ok(invalid.warnings.some(warning => warning.kind === 'analysis-failed'));
});

test('source hook invariant distinguishes repeated hook arguments and ignores nested callback calls', () => {
    const before = source('const handler = () => useNested(); useEffect(() => first(), []); useEffect(() => second(), []); return handler;');
    const moved = source('useEffect(() => first(), []); const handler = () => useNested(); useEffect(() => second(), []); return handler;');
    const swapped = source('const handler = () => useNested(); useEffect(() => second(), []); useEffect(() => first(), []); return handler;');
    const result = compareSources(before, moved, 'src/useProbe.ts', engines);
    assert.deepEqual(result.before.source.functions[0].hooks.map(hook => hook.name), ['useEffect', 'useEffect']);
    assert.equal(result.sourceHookSequencesEqual, true);
    assert.equal(compareSources(before, swapped, 'src/useProbe.ts', engines).sourceHookSequencesEqual, false);
});

test('function paths disambiguate duplicate names and recognize named arrows and imported hook aliases', () => {
    const code = `import React, {useEffect as effect} from 'react';
        function first() { function same() { effect(() => {}, []); } return same; }
        function second() { function same() { React.useState(1); } return same; }
        const namedArrow = () => { useCustom(); return 1; };
        const obj = {method() { fake.useUnknown(); }};`;
    const result = inspectCode(code, 'src/probe.js');
    const same = result.functions.filter(fn => fn.name === 'same');
    assert.equal(same.length, 2);
    assert.notEqual(same[0].id, same[1].id);
    assert.deepEqual(same.map(fn => fn.hooks[0].name), ['useEffect', 'useState']);
    assert.deepEqual(result.functions.find(fn => fn.name === 'namedArrow').hooks.map(hook => hook.name), ['useCustom']);
    assert.deepEqual(result.functions.find(fn => fn.name === 'method').hooks, []);
});

test('cache guards require runtime allocations and record property versus root dependencies', () => {
    const result = inspectCode(`import {c as cache} from 'react/compiler-runtime';
        export function Component(x) {
            const slots = cache(3);
            if (slots[0] !== x.foo || slots[1] !== x.bar) { build(x); }
            if (slots[2] === Symbol.for('react.memo_cache_sentinel')) { once(); }
            if (x.enabled) { always(); }
            return x;
        }
        function userCode($) { if ($[0] !== x) { notCached(); } }`, 'src/probe.js');
    assert.equal(result.cacheSlots, 3);
    assert.deepEqual(result.functions[0].guards[0].dependencies, ['x.bar', 'x.foo']);
    assert.deepEqual(result.functions[0].calls.find(call => call.name === 'build').guardDependencies, [['x.bar', 'x.foo']]);
    assert.equal(result.functions[0].calls.find(call => call.name === 'once').guarded, 1);
    assert.equal(result.functions[0].calls.find(call => call.name === 'always').unguarded, 1);
    assert.equal(result.functions[1].calls.find(call => call.name === 'notCached').unguarded, 1);
});

test('native diagnostics and lost caches remain visible in per-file reports', () => {
    const before = source('useEffect(() => {}, []); const a = build(x); return a;');
    const after = source('"use no memo"; useEffect(() => {}, []); const a = build(x); return a;');
    const result = compareSources(before, after, 'src/useProbe.ts', engines);
    assert.ok(result.warnings.some(warning => warning.kind === 'missing-cache'));
    const invalidHook = source('if (x) { useEffect(() => {}, []); } return x;');
    const diagnostic = compareSources(before, invalidHook, 'src/useProbe.ts', engines);
    assert.ok(diagnostic.after.diagnostics.length > 0);
    assert.ok(diagnostic.warnings.some(warning => warning.kind === 'compiler-diagnostics' && warning.side === 'after'));
});

test('root dependency widening is flagged as a heuristic and anonymous caches contribute to file totals', () => {
    const before = source('useEffect(() => {}, []); return build(x.foo);');
    const after = source('useEffect(() => {}, []); return build(x);');
    const result = compareSources(before, after, 'src/useProbe.ts', engines);
    assert.ok(result.warnings.some(warning => warning.kind === 'possible-root-dependency-widening' && warning.before === 'x.foo' && warning.after === 'x'));
    const anonymous = inspectCode('import {c as _c} from "react/compiler-runtime"; export default () => { const $ = _c(2); return $; };', 'src/probe.js');
    assert.equal(anonymous.cacheSlots, 2);
    assert.equal(anonymous.cacheAllocations, 1);
});

test('CLI compares base to staged, unstaged and committed tracked files without editing inputs', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-ordering-'));
    const worktree = path.join(directory, 'app');
    const git = args => execFileSync('git', ['-C', worktree, ...args], {encoding: 'utf8'}).trim();
    try {
        fs.mkdirSync(path.join(worktree, 'config/babel'), {recursive: true});
        fs.writeFileSync(path.join(worktree, 'package.json'), '{}');
        fs.copyFileSync(path.join(app, 'config/babel/oxcReactCompilerConfig.js'), path.join(worktree, 'config/babel/oxcReactCompilerConfig.js'));
        fs.symlinkSync(path.resolve(app, 'node_modules'), path.join(worktree, 'node_modules'), 'dir');
        git(['init', '--quiet']);
        git(['config', 'user.name', 'Comparison Test']);
        git(['config', 'user.email', 'test@example.com']);
        const before = source('const a = build(x); useEffect(() => {}, []); a.push(1); return a;');
        const after = source('useEffect(() => {}, []); const a = build(x); a.push(1); return a;');
        const filenames = ['committed.ts', 'staged.tsx', 'with space.jsx', 'plain.js'];
        for (const filename of filenames) {
            fs.writeFileSync(path.join(worktree, filename), before);
        }
        git(['add', '--', ...filenames]);
        git(['commit', '--quiet', '-m', 'Fixture base']);
        const base = git(['rev-parse', 'HEAD']);
        fs.writeFileSync(path.join(worktree, 'committed.ts'), after);
        git(['add', '--', 'committed.ts']);
        git(['commit', '--quiet', '-m', 'Fixture committed change']);
        for (const filename of filenames.slice(1)) {
            fs.writeFileSync(path.join(worktree, filename), after);
        }
        git(['add', '--', 'staged.tsx']);
        fs.writeFileSync(path.join(worktree, 'ignored.ts'), after);
        const status = git(['status', '--porcelain']);
        const output = path.join(directory, 'report.json');
        const artifacts = path.join(directory, 'artifacts');
        const cli = fileURLToPath(new URL('./compare-ordering.mjs', import.meta.url));
        const run = spawnSync(process.execPath, [cli, '--app', worktree, '--base', base, '--output', output, '--artifacts', artifacts], {encoding: 'utf8'});
        assert.equal(run.status, 0, run.stderr);
        const report = JSON.parse(fs.readFileSync(output, 'utf8'));
        assert.equal(report.versions.oxc, '0.156.0');
        assert.equal(report.compilerOptions.reportDiagnostics, true);
        assert.equal(report.summary.files, filenames.length);
        assert.equal(report.summary.analysisFailed, 0);
        assert.equal(report.summary.sourceHookSequenceChanges, 0);
        assert.equal(git(['status', '--porcelain']), status);
        for (const file of report.files) {
            assert.equal(fs.readFileSync(path.join(worktree, file.filename), 'utf8'), after);
            assert.equal(fs.readFileSync(file.artifacts.before.source, 'utf8'), before);
            assert.ok(fs.readFileSync(file.artifacts.after.emitted, 'utf8').includes('react/compiler-runtime'));
        }
        const unsafe = spawnSync(process.execPath, [cli, '--app', worktree, '--base', base, '--output', path.join(worktree, 'committed.ts')], {encoding: 'utf8'});
        assert.equal(unsafe.status, 1);
        assert.match(unsafe.stderr, /outside the App worktree/);
        assert.equal(fs.readFileSync(path.join(worktree, 'committed.ts'), 'utf8'), after);
        assert.throws(() => compareWorktree({app: worktree, base}, {...engines, versions: {oxc: '0.155.0'}}), /Expected native OXC/);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
});
