/* eslint-disable no-console, rulesdir/prefer-underscore-method */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const {values} = parseArgs({
    options: {
        app: {type: 'string'},
        target: {type: 'string'},
        samples: {type: 'string', default: '7'},
        output: {type: 'string'},
    },
});
assert(values.app, 'Pass --app /absolute/path/to/App to use its installed Oxlint');
const app = path.resolve(values.app);
const target = path.resolve(values.target || path.join(app, 'src'));
const samples = Number(values.samples);
assert(Number.isInteger(samples) && samples > 0, '--samples must be a positive integer');
const require = createRequire(path.join(app, 'package.json'));
const oxlintPackage = require.resolve('oxlint/package.json');
const oxlint = path.join(path.dirname(oxlintPackage), 'bin/oxlint');
const directory = path.dirname(fileURLToPath(import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'component-order-benchmark-'));
const plugin = path.join(directory, 'plugin.mjs');
const noop = path.join(temp, 'noop.mjs');
fs.writeFileSync(noop, `export default {
    meta: {name: 'ordering-poc'},
    rules: {'component-body-order': {
        meta: {schema: []},
        create() { return {FunctionDeclaration() {}, FunctionExpression() {}, ArrowFunctionExpression() {}}; },
    }},
};`);
const configurations = {
    parseOnly: {plugins: [], categories: {correctness: 'off'}, rules: {}},
    bridgeOnly: {
        plugins: [], categories: {correctness: 'off'}, jsPlugins: [noop], rules: {'ordering-poc/component-body-order': 'warn'},
    },
    rule: {
        plugins: [], categories: {correctness: 'off'}, jsPlugins: [plugin], rules: {'ordering-poc/component-body-order': 'warn'},
    },
};
const timings = {};
const summaries = {};

try {
    for (const [label, configuration] of Object.entries(configurations)) {
        fs.writeFileSync(path.join(temp, `${label}.json`), JSON.stringify(configuration));
        timings[label] = [];
    }

    // Alternate order to reduce warm-cache and thermal bias; all timings include process startup.
    for (let iteration = -2; iteration < samples; iteration++) {
        const labels = Object.keys(configurations);
        if (iteration % 2 === 0) {
            labels.reverse();
        }
        for (const label of labels) {
            const started = performance.now();
            const result = spawnSync(process.execPath, [oxlint, '--config', path.join(temp, `${label}.json`),
                '--disable-nested-config', '--threads', '1', '--format', 'json', target], {encoding: 'utf8', maxBuffer: 100 * 1024 * 1024});
            const elapsed = performance.now() - started;
            assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout}`);
            const summary = JSON.parse(result.stdout);
            assert.equal(summary.number_of_rules, label === 'parseOnly' ? 0 : 1);
            assert(summary.number_of_files > 0, 'Benchmark must lint files');
            assert(summary.diagnostics.every(item => item.code === 'ordering-poc(component-body-order)'), 'Unexpected diagnostics');
            summaries[label] = {files: summary.number_of_files, rules: summary.number_of_rules, diagnostics: summary.diagnostics.length};
            if (iteration >= 0) {
                timings[label].push(elapsed);
            }
        }
    }
    const results = {};
    for (const [label, runs] of Object.entries(timings)) {
        const sorted = [...runs].sort((a, b) => a - b);
        results[label] = {
            ...summaries[label], medianMs: sorted[Math.floor(sorted.length / 2)], minMs: sorted[0], maxMs: sorted.at(-1), runsMs: runs,
        };
    }
    const report = {
        node: process.version,
        oxlint: JSON.parse(fs.readFileSync(oxlintPackage, 'utf8')).version,
        cpu: os.cpus()[0].model,
        platform: `${os.platform()} ${os.arch()}`,
        target,
        samples,
        threads: 1,
        warmups: 2,
        results,
        ruleOverBridgeMs: results.rule.medianMs - results.bridgeOnly.medianMs,
    };
    const json = `${JSON.stringify(report, null, 4)}\n`;
    if (values.output) {
        fs.writeFileSync(values.output, json);
    }
    console.log(json);
} finally {
    // Only remove the temporary files created by this invocation.
    for (const entry of fs.readdirSync(temp)) {
        fs.unlinkSync(path.join(temp, entry));
    }
    fs.rmdirSync(temp);
}
