/* eslint-disable no-console, rulesdir/prefer-underscore-method -- Standalone benchmark output and native collections. */
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const {values} = parseArgs({
    options: {
        app: {type: 'string'},
        target: {type: 'string'},
        limit: {type: 'string', default: '25'},
        samples: {type: 'string', default: '5'},
        output: {type: 'string'},
        'config-ref': {type: 'string', default: 'b14f3591fad1db21c32271e79e9fe66b433fc5dc'},
    },
});
assert(values.app && values.target, 'Pass --app /path/to/App --target /path/to/pinned/source');
const limit = Number(values.limit);
const samples = Number(values.samples);
assert(Number.isInteger(limit) && limit > 0);
assert(Number.isInteger(samples) && samples > 0);
const target = path.resolve(values.target);
const app = path.resolve(values.app);
const configFile = 'config/babel/oxcReactCompilerConfig.js';
const configPath = path.join(app, configFile);
const pinnedConfig = execFileSync('git', ['show', `${values['config-ref']}:${configFile}`], {cwd: app, encoding: 'utf8'});
assert(!/\b(?:require|import)\b/.test(pinnedConfig), 'Benchmark requires a self-contained compiler config; imported config dependencies need separate pinning');
const configHash = createHash('sha256').update(pinnedConfig).digest('hex');
function verifyConfig() {
    assert.equal(fs.readFileSync(configPath, 'utf8'), pinnedConfig, 'Working compiler config must match the pinned Git blob');
}
verifyConfig();
function discover(filename) {
    if (fs.statSync(filename).isFile()) {
        return /\.[jt]sx?$/.test(filename) && !filename.endsWith('.d.ts') ? [filename] : [];
    }
    return fs.readdirSync(filename, {withFileTypes: true}).filter(entry => !entry.isSymbolicLink() && entry.name !== 'node_modules')
        .flatMap(entry => discover(path.join(filename, entry.name)));
}
const available = discover(target).sort();
assert(available.length > 0, 'No source files');
const count = Math.min(limit, available.length);
const files = Array.from({length: count}, (value, index) => available[count === 1
    ? Math.floor(available.length / 2)
    : Math.round((index * (available.length - 1)) / (count - 1))]);
const fingerprint = createHash('sha256');
for (const filename of files) {
    fingerprint.update(path.relative(target, filename));
    fingerprint.update('\0');
    fingerprint.update(fs.readFileSync(filename));
    fingerprint.update('\0');
}
const cli = fileURLToPath(new URL('../../tooling/memoization/report.mjs', import.meta.url));
const runs = [];
let report;
let reportHash;
let exitCode;
for (let iteration = -1; iteration < samples; iteration++) {
    verifyConfig();
    const started = performance.now();
    const result = spawnSync(process.execPath, [cli, '--app', path.resolve(values.app), '--json', '--', ...files], {
        encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    const elapsed = performance.now() - started;
    verifyConfig();
    assert(result.status === 0 || result.status === 1, result.stderr || 'Reporter process failed');
    report = JSON.parse(result.stdout);
    assert.equal(report.configPath, configPath);
    if (exitCode !== undefined) {
        assert.equal(result.status, exitCode, 'Reporter exit status must be deterministic');
    }
    exitCode = result.status;
    assert.equal(report.files.length, files.length, 'Every requested file must be accounted for');
    assert.deepEqual(report.files.map(file => path.resolve(file.filename)).sort(), [...files].sort(), 'Report must cover the exact input files');
    const hash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
    if (reportHash) {
        assert.equal(hash, reportHash, 'Report must be deterministic across fresh processes');
    }
    reportHash = hash;
    if (iteration >= 0) {
        runs.push(elapsed);
    }
}
const sorted = [...runs].sort((a, b) => a - b);
const middle = Math.floor(sorted.length / 2);
const output = {
    node: process.version,
    cpu: os.cpus()[0].model,
    versions: report.versions,
    configRef: values['config-ref'],
    configHash,
    compilerOptions: report.compilerOptions,
    target,
    files: files.map(filename => path.relative(target, filename) || path.basename(filename)),
    corpusHash: fingerprint.digest('hex'),
    reportHash,
    reporterExitCode: exitCode,
    statuses: report.files.map(file => ({
        filename: file.filename, babel: file.babel && file.babel.status, oxc: file.oxc && file.oxc.status, failure: file.failure || null,
    })),
    warmups: 1,
    samples,
    medianMs: sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle],
    minMs: sorted[0],
    maxMs: sorted.at(-1),
    runsMs: runs,
};
const json = `${JSON.stringify(output, null, 4)}\n`;
if (values.output) {
    fs.writeFileSync(values.output, json);
}
console.log(json);
