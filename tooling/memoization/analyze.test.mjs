/* eslint-disable rulesdir/prefer-underscore-method -- The test inspects native arrays. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {analyzeSource, loadEngines} from './analyze.mjs';

const app = process.env.MEMOIZATION_APP || fileURLToPath(new URL('../../../App/', import.meta.url));
const engines = loadEngines(app);

function analyze(body) {
    return analyzeSource(`import {useEffect} from 'react';
import {build} from './operations';
export function useProbe(x) { ${body} }`, 'src/hooks/useProbe.ts', engines);
}

test('reports an unguarded native construction spanning a hook, but not a complete one', () => {
    const before = analyze('const a = build(x); useEffect(() => {}, []); a.push(1); return a;');
    assert.equal(before.status, 'compiled-output');
    assert.deepEqual(before.diagnostics, []);
    assert.equal(before.findings.length, 1);
    assert.equal(before.findings[0].kind, 'oxc-unguarded-hook-crossing-candidate');
    assert.equal(before.findings[0].value.name, 'a');
    assert.equal(before.findings[0].hook.name, 'useEffect');
    assert.equal(before.findings[0].continuation.operation, 'push');
    const after = analyze('useEffect(() => {}, []); const a = build(x); a.push(1); return a;');
    assert.deepEqual(after.findings, []);
});

test('recognizes an unguarded construction even when other native caches are present', () => {
    const result = analyze('const a = build(x); useEffect(() => {}, []); a.find(item => item); return a;');
    assert.equal(result.status, 'compiled-output');
    assert.equal(result.findings.length, 1);
});

test('finds arrays with a conditional push before and another push after the hook', () => {
    const result = analyze('const a = []; if (x) { a.push(1); } useEffect(() => {}, []); a.push(2); return a;');
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].value.kind, 'ArrayExpression');
});

test('matches emitted declarations inside their owning function', () => {
    const source = `import {useEffect} from 'react';
import {build} from './operations';
export function useProbe(x) { const a = build(x); useEffect(() => {}, []); a.push(1); return a; }
export function useOther(x) { const a = build(x); useEffect(() => {}, []); a.push(1); return a; }`;
    const report = analyzeSource(source, 'src/hooks/useProbe.ts', engines);
    assert.deepEqual(report.findings.map(finding => finding.function), ['useProbe', 'useOther']);
});

test('does not mistake object methods or caller-provided runtime imports for compiled hook evidence', () => {
    const source = `import {useEffect} from 'react';
import {build} from './operations';
export function useProbe(x, obj) { const a = build(x); obj.useThing(); a.push(1); return a; }`;
    assert.deepEqual(analyzeSource(source, 'src/hooks/useProbe.ts', engines).findings, []);
    const importedRuntime = `import 'react/compiler-runtime';\n${source.replace('obj.useThing()', 'useEffect(() => {}, [])')}`;
    assert.deepEqual(analyzeSource(importedRuntime, 'src/hooks/useProbe.ts', engines).findings, []);
    const skippedFunction = `import {useEffect} from 'react';
export function useProbe(x) { 'use no memo'; const a = build(x); useEffect(() => {}, []); a.push(1); return a; }
export function useCompiled() { const value = []; useEffect(() => {}, []); return value; }`;
    assert.deepEqual(analyzeSource(skippedFunction, 'src/hooks/useProbe.ts', engines).findings, []);
});

test('a user-defined $.enabled check is not an OXC cache guard', () => {
    const source = `import {useEffect} from 'react';
export function useProbe(x) { const a = build(x); useEffect(() => {}, []); a.push(1); return a; }`;
    const fake = {
        config: () => ({}),
        oxc: {
            transformSync(filename, text, options) {
                return {
                    fatal: false,
                    errors: [],
                    code: options.reactCompiler
                        ? `import {c as _c} from 'react/compiler-runtime'; export function useProbe(x) {
                        const $ = _c(2);
                        if ($.enabled) { const a = build(x); useEffect(() => {}, []); a.push(1); return a; }
                    }`
                        : text,
                };
            },
        },
    };
    const report = analyzeSource(source, 'src/hooks/useProbe.ts', fake);
    assert.equal(report.findings.length, 1);
});

test('rejects ineligible, invalid, conditional-hook, and unsupported source patterns', () => {
    assert.deepEqual(analyze('const a = build(x); a.push(1); useEffect(() => {}, []); return a;').findings, []);
    assert.deepEqual(analyze('const [a] = useState(x); useEffect(() => {}, []); return a;').findings, []);
    assert.deepEqual(analyze('const a = build(x); useEffect(() => {}, []); return a;').findings, []);
    assert.equal(analyze('const a = build(x); if (x) { useEffect(() => {}, []); } a.push(1); return a;').status, 'diagnostics');
    assert.equal(analyzeSource('export function {', 'invalid.js', engines).status, 'failed');
    assert.throws(() => analyzeSource('', 'invalid.json', engines), /Unsupported/);
});

test('CLI emits deterministic native-only JSON, preserves inputs, and reports errors', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'memoization-oxc-test-'));
    try {
        const filename = path.join(directory, 'useProbe.ts');
        const source = 'import {useEffect} from "react"; export function useProbe(x) { const a = []; useEffect(() => {}, []); a.push(x); return a; }';
        fs.writeFileSync(filename, source);
        const cli = fileURLToPath(new URL('./report.mjs', import.meta.url));
        const run = input => spawnSync(process.execPath, [cli, '--app', app, '--json', '--', input], {encoding: 'utf8'});
        const first = run(filename);
        assert.equal(first.status, 0, first.stderr);
        const report = JSON.parse(first.stdout);
        assert.equal(report.versions.oxc, engines.versions.oxc);
        assert.deepEqual(Object.keys(report.versions).sort(), ['node', 'oxc']);
        assert.equal(report.files[0].filename, filename);
        assert.equal(first.stdout, run(filename).stdout);
        assert.equal(fs.readFileSync(filename, 'utf8'), source);
        assert.equal(run(path.join(directory, 'missing.ts')).status, 1);
    } finally {
        fs.unlinkSync(path.join(directory, 'useProbe.ts'));
        fs.rmdirSync(directory);
    }
});
