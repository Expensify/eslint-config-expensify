/* eslint-disable no-console, rulesdir/prefer-underscore-method -- Standalone integration checks print their result. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const {values} = parseArgs({options: {app: {type: 'string'}}});
assert(values.app, 'Pass --app /path/to/App');
const requireApp = createRequire(path.resolve(values.app, 'package.json'));
const oxlint = path.join(path.dirname(requireApp.resolve('oxlint/package.json')), 'bin/oxlint');
const {transformSync} = requireApp('oxc-transform-react');
const compilerConfig = requireApp(path.resolve(values.app, 'config/babel/oxcReactCompilerConfig.js'));
const config = fileURLToPath(new URL('./oxlint.json', import.meta.url));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'component-order-fix-'));
const fixtures = {
    handler: `import {useEffect} from 'react';
export function Panel({value}) {
    useEffect(() => {}, []);
    const closePanel = () => value;
    return <button onClick={closePanel} />;
}
`,
    construction: `import {useEffect} from 'react';
import {buildItems} from './operations';
export function Panel({items}) {
    useEffect(() => {}, []);
    const result = buildItems(items);
    result.push(1);
    return <div>{result.length}</div>;
}
`,
    directive: `import {useEffect} from 'react';
export function Panel({value}) {
    useEffect(() => {}, []);
    // eslint-disable-next-line no-unused-vars
    const closePanel = () => value;
    return <div />;
}
`,
};

function run() {
    const result = spawnSync(process.execPath, [oxlint, '--config', config, '--disable-nested-config', '--threads', '1', '--format', 'json', '--fix', directory], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.number_of_rules, 1);
    assert.equal(report.number_of_files, Object.keys(fixtures).length);
    assert(report.diagnostics.every(item => item.code === 'ordering-poc(component-body-order)'));
    return Object.fromEntries(Object.keys(fixtures).map(name => [name, fs.readFileSync(path.join(directory, `${name}.tsx`), 'utf8')]));
}

try {
    for (const [name, source] of Object.entries(fixtures)) {
        fs.writeFileSync(path.join(directory, `${name}.tsx`), source);
    }
    const fixed = run();
    assert.notEqual(fixed.handler, fixtures.handler, 'Inert handler must be moved');
    assert(fixed.handler.indexOf('const closePanel') < fixed.handler.indexOf('useEffect(()'), 'Handler belongs before the effect');
    assert.equal(fixed.construction, fixtures.construction, 'Do not split allocation from later mutation');
    assert.equal(fixed.directive, fixtures.directive, 'Do not change directive attachment');
    assert.deepEqual(run(), fixed, 'Native Oxlint autofix must be idempotent');
    for (const [name, source] of Object.entries(fixed)) {
        const result = transformSync(`src/components/${name}.tsx`, source, {lang: 'tsx', reactCompiler: {...compilerConfig(), reportDiagnostics: true}});
        assert.equal(result.fatal, false, `${name}: native compiler failure`);
        assert.deepEqual(result.errors, [], `${name}: compiler diagnostics`);
    }
    console.log('Native Oxlint autofix passed: handler ordering, mutation/directive barriers, idempotence and OXC compilation.');
} finally {
    for (const name of Object.keys(fixtures)) {
        fs.unlinkSync(path.join(directory, `${name}.tsx`));
    }
    fs.rmdirSync(directory);
}
