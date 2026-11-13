/* eslint-disable es/no-optional-chaining, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * Replays the cases of eslint-plugin-expensify's rule tests through oxlint, with this package's rulesdir plugin. Every
 * `valid` case must report nothing, and every `invalid` case the errors its ESLint test expects (count, lines, messages).
 * ESLint's own run stays the source of truth: the Jest suite proves the expectations, and this file only checks that
 * oxlint gives the same results.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {rules} from '../plugins/rulesdir.js';
import {getOxlintEnvironment, packageDirectory} from './helpers.mjs';
import {captureRuleTests, compareCase, replaySuite} from './rule-tester-shim.mjs';

const oxlintBinary = `${packageDirectory}node_modules/.bin/oxlint`;
const pluginSpecifier = fileURLToPath(new URL('../plugins/rulesdir.js', import.meta.url));
const ruleDirectory = fileURLToPath(new URL('../../eslint-plugin-expensify/', import.meta.url));
const testDirectory = fileURLToPath(new URL('../../eslint-plugin-expensify/tests/', import.meta.url));

// How many oxlint runs go at once. There is one run per rule file.
const CONCURRENCY = 4;

const suites = await captureRuleTests(testDirectory, ruleDirectory);
const testFileCount = fs.readdirSync(testDirectory).filter(name => name.endsWith('.test.js')).length;

// The suites of rules rulesdir.js leaves out (they need type information) have no `rulesdir/<name>` in oxlint to replay.
const replayedSuites = suites.filter(suite => suite.ruleName in rules);

let running = 0;
const waiting = [];

/**
 * Runs a job once fewer than CONCURRENCY jobs are running.
 * @template T
 * @param {() => Promise<T>} job
 * @returns {Promise<T>}
 */
async function limited(job) {
    if (running >= CONCURRENCY) {
        await new Promise((resolve) => {
            waiting.push(resolve);
        });
    }
    running++;
    try {
        return await job();
    } finally {
        running--;
        waiting.shift()?.();
    }
}

// Starts every replay now, so the test of a rule only waits for its own.
const environment = getOxlintEnvironment();
const replays = new Map(replayedSuites.map(suite => [suite, limited(() => replaySuite(suite, {oxlintBinary, env: environment, pluginSpecifier}))]));

// The test of the rule reports a failed run, so it must not count as unhandled before that test starts.
for (const replay of replays.values()) {
    replay.catch(() => {});
}

test('every rule test file is captured', () => {
    // Then a change that stops the capture cannot pass unnoticed, since every test file calls ruleTester.run once
    assert.equal(suites.length, testFileCount);
});

test('every replayed rule has an invalid case', () => {
    // Then the replay shows that each rule ran in oxlint at all, since only an invalid case reports
    assert.ok(replayedSuites.length > 0, 'no rule is replayed');
    assert.deepEqual(
        replayedSuites.filter(suite => !suite.cases.some(testCase => testCase.kind === 'invalid')).map(suite => suite.ruleName),
        [],
    );
});

for (const suite of replayedSuites) {
    test(`rulesdir/${suite.ruleName} in oxlint gives the results its ESLint test expects`, async () => {
        // Given every case of the ESLint test as a file of its own, with the rule on
        // When oxlint lints them all
        const {results, stderr} = await replays.get(suite);

        // Then every case gives what the ESLint test expects
        const failures = suite.cases.map(testCase => compareCase(suite, testCase, results.get(testCase))).filter(Boolean);
        assert.ok(failures.length === 0, `${failures.length} of ${suite.cases.length} cases differ from the ESLint test (oxlint stderr: ${stderr.slice(0, 500)})\n${failures.join('\n')}`);
    });
}
