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
import {DROPPED_RULES, STAND_INS} from '../tables.js';
import {getOxlintEnvironment, packageDirectory} from './helpers.mjs';
import {captureRuleTests, compareCase, replaySuite} from './rule-tester-shim.mjs';

const oxlintBinary = `${packageDirectory}node_modules/.bin/oxlint`;
const pluginSpecifier = fileURLToPath(new URL('../plugins/rulesdir.js', import.meta.url));
const ruleDirectory = fileURLToPath(new URL('../../eslint-plugin-expensify/', import.meta.url));
const testDirectory = fileURLToPath(new URL('../../eslint-plugin-expensify/tests/', import.meta.url));

// How many oxlint runs go at once. There is one run per rule file.
const CONCURRENCY = 4;

// Cases where oxlint gives another result than ESLint and nothing here can change that, as `<rule> <kind>[<index>]` with the
// reason. The test fails when a listed case starts to match, so an entry cannot outlive its difference.
const KNOWN_DIFFERENCES = {};

const suites = await captureRuleTests(testDirectory, ruleDirectory);
const testFileCount = fs.readdirSync(testDirectory).filter(name => name.endsWith('.test.js')).length;
const ruleFiles = fs.readdirSync(ruleDirectory).filter(name => name.endsWith('.js') && name !== 'CONST.js').map(name => name.replace(/\.js$/, '')).sort();

// The rules rulesdir.js leaves out, which have no `rulesdir/<name>` in oxlint to replay.
const leftOut = ruleFiles.filter(name => !(name in rules));
const skippedSuites = suites.filter(suite => !(suite.ruleName in rules));
const replayedSuites = suites.filter(suite => suite.ruleName in rules);

/**
 * @param {string} ruleName a rule file name
 * @returns {string} why the rule is not replayed
 */
function getSkipReason(ruleName) {
    const ruleID = `rulesdir/${ruleName}`;
    if (DROPPED_RULES[ruleID]) {
        return `tables.js drops it: ${DROPPED_RULES[ruleID]}`;
    }
    if (STAND_INS[ruleID]) {
        return `tables.js replaces it with ${STAND_INS[ruleID]}, and rulesdir.js leaves it out because it needs type information`;
    }
    return 'rulesdir.js leaves it out because it needs type information';
}

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

test('the rules that are not replayed are the ones rulesdir.js leaves out', () => {
    // Given the rule files, the rules rulesdir.js exports, and the suites of the rule tests
    // Then the skipped suites are exactly the rule files that rulesdir.js does not export
    assert.deepEqual([...new Set(skippedSuites.map(suite => suite.ruleName))].sort(), leftOut);
    assert.ok(leftOut.length > 0, 'expected at least one rule that needs type information');

    // And every rulesdir rule the conversion drops or replaces is one of them, so the replay never leaves out a rule the presets can run
    for (const ruleID of [...Object.keys(DROPPED_RULES), ...Object.keys(STAND_INS)].filter(id => id.startsWith('rulesdir/'))) {
        assert.ok(leftOut.includes(ruleID.replace('rulesdir/', '')), `${ruleID} is dropped or replaced in tables.js, so rulesdir.js must leave it out`);
    }
});

test('the replay covers the rule tests', (t) => {
    // Given the suites of the rule tests
    const replayedCases = replayedSuites.flatMap(suite => suite.cases);
    const invalidCases = replayedCases.filter(testCase => testCase.kind === 'invalid');
    t.diagnostic(`replayed ${replayedSuites.length} rule files with ${replayedCases.length} cases (${invalidCases.length} invalid)`);
    t.diagnostic(`skipped ${skippedSuites.length} rule files with ${skippedSuites.flatMap(suite => suite.cases).length} cases`);
    for (const suite of skippedSuites) {
        t.diagnostic(`  ${suite.ruleName} (${suite.cases.length} cases): ${getSkipReason(suite.ruleName)}`);
    }

    // Then a change that stops the capture or the replay cannot pass unnoticed
    assert.equal(suites.length, testFileCount, 'every test file calls ruleTester.run once');
    assert.ok(replayedSuites.length >= 30, `only ${replayedSuites.length} rule files are replayed`);
    assert.ok(replayedCases.length >= 400, `only ${replayedCases.length} cases are replayed`);
    assert.ok(invalidCases.length >= 200, `only ${invalidCases.length} invalid cases are replayed`);

    // And every replayed rule has an invalid case, which is what shows that the rule ran in oxlint at all
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

        // Then every case gives what the ESLint test expects, apart from the listed differences
        const failures = [];
        const staleKnownDifferences = [];
        for (const testCase of suite.cases) {
            const key = `${suite.ruleName} ${testCase.kind}[${testCase.index}]`;
            const difference = compareCase(suite, testCase, results.get(testCase));
            if (difference && !(key in KNOWN_DIFFERENCES)) {
                failures.push(difference);
            }
            if (!difference && key in KNOWN_DIFFERENCES) {
                staleKnownDifferences.push(key);
            }
        }
        assert.ok(failures.length === 0, `${failures.length} of ${suite.cases.length} cases differ from the ESLint test (oxlint stderr: ${stderr.slice(0, 500)})\n${failures.join('\n')}`);
        assert.deepEqual(staleKnownDifferences, [], 'these cases now match ESLint, so remove them from KNOWN_DIFFERENCES');
    });
}
