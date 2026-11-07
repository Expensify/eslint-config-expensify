/* eslint-disable no-console, rulesdir/prefer-underscore-method */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const {values} = parseArgs({options: {app: {type: 'string'}}});
assert(values.app, 'Pass --app /absolute/path/to/App');
const requireApp = createRequire(path.resolve(values.app, 'package.json'));
const oxlint = path.join(path.dirname(requireApp.resolve('oxlint/package.json')), 'bin/oxlint');
const config = fileURLToPath(new URL('./oxlint.json', import.meta.url));
const fixtures = [
    ['effect-derived', 'function Component() { useEffect(effect, []); const value = derive(); return value; }', 1],
    ['captured', 'function Component() { useEffect(() => value, []); const value = derive(); return value; }', 0],
    ['hook-argument', 'function Component() { const key = makeKey(); const [data] = useOnyx(key); return data; }', 0],
    ['wrapped-hook', 'function Component() { useEffect(effect, []); const value = useState(0) as State; return value; }', 0],
    ['nested-hook', 'function Component() { useEffect(effect, []); const value = wrap(useState(0)); return value; }', 0],
    ['iife-hook', 'function Component() { useEffect(effect, []); const value = (() => useState(0))(); return value; }', 0],
    ['computed-hook', 'function Component() { useEffect(effect, []); const value = React[hookName](0); return value; }', 0],
    ['template-hook', 'function Component() { useEffect(effect, []); const value = React[`useState`](0); return value; }', 0],
    ['late-alias', 'function Component() { useEffect(effect, []); const value = readState(0); return value; } import {useState as readState} from "react";', 0],
    ['shadowed-alias', 'import {useState as readState} from "react"; function Component(readState) { useEffect(effect, []); const value = readState(0); return value; }', 1],
    ['anchors', 'function Component() { useEffect(effect, []); const value = 1; const state = useState(0); return [value, state]; }', 1],
    ['wrapper', 'const Component = memo(forwardRef(() => { useEffect(effect, []); const value = derive(); return value; }));', 1],
];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'component-order-oxlint-'));
try {
    for (const [name, code] of fixtures) {
        fs.writeFileSync(path.join(temp, `${name}.tsx`), code);
    }
    const result = spawnSync(process.execPath, [oxlint, '--config', config, '--disable-nested-config', '--threads', '1', '--format', 'json', '--fix', temp], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.number_of_rules, 1);
    assert.equal(summary.number_of_files, fixtures.length);
    for (const [name, code, expected] of fixtures) {
        const filename = `${name}.tsx`;
        const diagnostics = summary.diagnostics.filter(diagnostic => path.basename(diagnostic.filename) === filename);
        assert.equal(diagnostics.length, expected, `${name}: ${JSON.stringify(diagnostics)}`);
        assert(diagnostics.every(diagnostic => diagnostic.code === 'ordering-poc(component-body-order)'));
        assert.equal(fs.readFileSync(path.join(temp, filename), 'utf8'), code, `${name}: --fix must not change source`);
    }
    console.log(`Oxlint integration passed: ${fixtures.length} fixtures, one rule, --fix leaves all sources unchanged.`);
} finally {
    for (const [name] of fixtures) {
        fs.unlinkSync(path.join(temp, `${name}.tsx`));
    }
    fs.rmdirSync(temp);
}
