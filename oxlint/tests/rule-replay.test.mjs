/* eslint-disable es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/**
 * Replays the cases of eslint-plugin-expensify's rule tests through oxlint, with this package's rulesdir plugin. Every
 * `valid` case must report nothing, and every `invalid` case as many errors as its ESLint test expects. ESLint's own run
 * stays the source of truth: the Jest suite proves the expectations, and this file only checks that oxlint gives the same
 * number of errors.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import {rules} from '../plugins/rulesdir.js';
import {DROPPED_RULES, STAND_INS} from '../tables.js';
import {getOxlintEnvironment, packageDirectory} from './helpers.mjs';
import {captureRuleTests, replaySuite} from './rule-tester-shim.mjs';

const oxlintBinary = `${packageDirectory}node_modules/.bin/oxlint`;
const pluginSpecifier = fileURLToPath(new URL('../plugins/rulesdir.js', import.meta.url));
const ruleDirectory = fileURLToPath(new URL('../../eslint-plugin-expensify/', import.meta.url));
const testDirectory = fileURLToPath(new URL('../../eslint-plugin-expensify/tests/', import.meta.url));

// How many oxlint runs go at once. There is one run per rule file.
const CONCURRENCY = 4;

// Rules that rulesdir.js leaves out because they call ESLintUtils.getParserServices, so oxlint has no `rulesdir/<name>` to replay.
const SKIPPED_RULES = ['boolean-conditional-rendering', 'prefer-at', 'prefer-locale-compare-from-context'];

const suites = await captureRuleTests(testDirectory, ruleDirectory);
const testFileCount = fs.readdirSync(testDirectory).filter(name => name.endsWith('.test.js')).length;
const replayedSuites = suites.filter(suite => !SKIPPED_RULES.includes(suite.ruleName));

// Runs the replays a few at a time, and keeps a failed run as the result of its rule so that the test of the rule reports it.
const options = {oxlintBinary, env: getOxlintEnvironment(), pluginSpecifier};
const replays = new Map();
const queue = [...replayedSuites];
await Promise.all(Array.from({length: CONCURRENCY}, async () => {
    for (let suite = queue.shift(); suite; suite = queue.shift()) {
        replays.set(suite, await replaySuite(suite, options).catch(error => ({error})));
    }
}));

test('every rule test file is captured', () => {
    // Then a change that stops the capture cannot pass unnoticed, since every test file calls ruleTester.run once
    assert.equal(suites.length, testFileCount);
});

test('the skipped rules are the ones the plugin leaves out', () => {
    // Then no skipped rule is exported by rulesdir.js, and every rulesdir rule that tables.js drops or replaces is skipped
    assert.deepEqual(SKIPPED_RULES.filter(name => name in rules), []);
    const dropped = [...Object.keys(DROPPED_RULES), ...Object.keys(STAND_INS)].filter(id => id.startsWith('rulesdir/')).map(id => id.replace('rulesdir/', ''));
    assert.deepEqual(dropped.filter(name => !SKIPPED_RULES.includes(name)), []);
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
    test(`rulesdir/${suite.ruleName} in oxlint reports as many errors as its ESLint test expects`, () => {
        // Given every case of the ESLint test as a file of its own, with the rule on, linted by oxlint
        const {results, stderr, error} = replays.get(suite);
        assert.ifError(error);

        // Then every case gets the number of errors the ESLint test expects
        const ruleCode = `rulesdir(${suite.ruleName})`;
        const failures = [];
        for (const testCase of suite.cases) {
            const reported = results.get(testCase);
            const actual = reported.filter(diagnostic => diagnostic.code === ruleCode).length;

            // Any other diagnostic is a parse error or a config problem, which would hide a missing report
            if (actual !== testCase.expected || reported.length !== actual) {
                failures.push([
                    `${suite.ruleName} ${testCase.kind}[${testCase.index}] (${suite.testFile})`,
                    `  code: ${JSON.stringify(testCase.code)}`,
                    ...(testCase.filename ? [`  filename: ${testCase.filename}`] : []),
                    `  expected ${testCase.expected} errors, oxlint gave ${actual} of ${reported.length} diagnostics`,
                    ...reported.map(diagnostic => `  ${diagnostic.code ?? 'parse error'}: ${diagnostic.message}`),
                ].join('\n'));
            }
        }
        assert.ok(failures.length === 0, `${failures.length} of ${suite.cases.length} cases differ from the ESLint test (oxlint stderr: ${stderr.slice(0, 500)})\n${failures.join('\n')}`);
    });
}
