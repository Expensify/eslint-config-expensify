/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {isDeepStrictEqual} from 'node:util';

import {buildOxlintConfig} from '../index.js';
import {
    DROPPED_RULES, DROPPED_WITHOUT_NURSERY, DROP_OPTIONS, STAND_INS,
} from '../tables.js';
import {ALL_PRESETS, EXPORTED_PRESETS} from './helpers.mjs';
import {
    SAMPLE_FILES, createFileMatcher, resolveESLintRules, resolveOxlintRules, toComparisonKey, toESLintID,
} from './parity-helpers.mjs';

// Exceptions to "oxlint runs what ESLint runs, with the same options". The dropped rules, stand-ins and dropped options come from
// oxlint/tables.js, and each rule below is one that convert.js changes without a table.
const STAND_IN_SOURCES = Object.fromEntries(Object.entries(STAND_INS).map(([ruleID, standIn]) => [standIn, ruleID]));

// The preset sets maxDepth to the string "∞" and oxlint takes only a number, so convert.js leaves it out.
const NO_CYCLE = 'import/no-cycle';

// ESLint runs typescript-eslint's no-unused-vars on TypeScript files, which reports values used only as types. oxlint's
// rule does that only with this option, so convert.js adds it to the rule's options in blocks for TypeScript files.
const TS_NO_UNUSED_VARS = '@typescript-eslint/no-unused-vars';

// The least number of rule entries the combined run compares, so that a run which compares nothing cannot pass.
const MIN_COMBINED_ENTRIES = 3000;

const matcher = createFileMatcher(SAMPLE_FILES);
after(() => matcher.remove());

/**
 * @param {string} ruleID an ESLint rule ID
 * @param {unknown[]} entry what ESLint runs the rule with, as `[severity, ...options]`
 * @returns {unknown[]} what oxlint is expected to run it with: the entry as the conversion writes it
 */
function getExpectedOxlintEntry(ruleID, entry) {
    const [severity, options, ...rest] = entry;
    if (ruleID in STAND_INS || DROP_OPTIONS.has(ruleID)) {
        return entry.length === 1 ? entry : [severity];
    }
    if (ruleID === NO_CYCLE && options?.maxDepth === '∞') {
        const {maxDepth, ...otherOptions} = options;
        return [severity, otherOptions, ...rest];
    }
    if (ruleID === TS_NO_UNUSED_VARS && options) {
        return [severity, {...options, reportVarsOnlyUsedAsTypes: true}, ...rest];
    }
    return entry;
}

/**
 * Indexes the rules of one file by comparison key, so one rule that has two names is one entry.
 * @param {Array<{ruleID: string, name: string, entry: unknown[]}>} rules
 * @param {string} file
 * @param {string[]} failures where a key that two rules share is reported
 * @returns {Map<string, {ruleID: string, name: string, entry: unknown[]}>}
 */
function indexByKey(rules, file, failures) {
    const byKey = new Map();
    for (const rule of rules) {
        const key = toComparisonKey(rule.ruleID);
        if (byKey.has(key)) {
            failures.push(`${file} ${key}: both ${byKey.get(key).name} and ${rule.name} are on, so they cannot be compared`);
            continue;
        }
        byKey.set(key, rule);
    }
    return byKey;
}

/**
 * Compares the rules ESLint and oxlint run on each file.
 * @param {Map<string, Map<string, unknown[]>>} eslintRules the rules that are on, by file and ESLint rule ID
 * @param {Map<string, Map<string, unknown[]>>} oxlintRules the rules that are on, by file and the name oxlint runs them under
 * @param {boolean} withNursery whether the config was built with `withNursery`
 * @returns {{failures: string[], compared: number}} one failure for each difference that no table or exception declares (the
 * file, the rule, and both entries), and the number of entries compared
 */
function compareRules(eslintRules, oxlintRules, withNursery) {
    const failures = [];
    let compared = 0;
    const show = found => (found ? JSON.stringify(found.entry) : 'not on');
    for (const [file, eslintOn] of eslintRules) {
        const oxlintOn = oxlintRules.get(file);
        if (!oxlintOn) {
            failures.push(`${file}: ESLint lints it, oxlint does not`);
            continue;
        }

        // A rule that oxlint runs in place of another is compared under the ESLint rule's ID.
        const eslintByKey = indexByKey([...eslintOn].map(([ruleID, entry]) => ({ruleID, name: ruleID, entry})), file, failures);
        const oxlintByKey = indexByKey([...oxlintOn].map(([name, entry]) => {
            const sourceID = STAND_IN_SOURCES[toESLintID(name)];
            return {ruleID: sourceID && eslintOn.has(sourceID) ? sourceID : toESLintID(name), name, entry};
        }), file, failures);
        for (const key of new Set([...eslintByKey.keys(), ...oxlintByKey.keys()])) {
            compared++;
            const eslintFound = eslintByKey.get(key);
            const oxlintFound = oxlintByKey.get(key);
            const ruleID = eslintFound?.ruleID ?? oxlintFound.ruleID;
            const report = () => failures.push(`${file} ${ruleID}\n    ESLint: ${show(eslintFound)}\n    oxlint: ${show(oxlintFound)}`);
            const isDropped = ruleID in DROPPED_RULES || (!withNursery && ruleID in DROPPED_WITHOUT_NURSERY);
            if (!eslintFound || !oxlintFound) {
                // ESLint runs it and oxlint does not: fine for a dropped rule. oxlint runs it and ESLint does not: never.
                if (!isDropped || oxlintFound) {
                    report();
                }
                continue;
            }
            const expected = getExpectedOxlintEntry(ruleID, eslintFound.entry);
            if (isDropped || !isDeepStrictEqual(expected, oxlintFound.entry)) {
                report();
            }
        }
    }
    return {failures, compared};
}

/**
 * Builds the oxlint config for the presets and compares what both linters run on every sample file.
 * @param {string[]} presets
 * @param {boolean} [withNursery]
 * @returns {Promise<ReturnType<typeof compareRules> & {files: number}>}
 */
async function compareRun(presets, withNursery = false) {
    const config = await buildOxlintConfig({presets, withNursery, reactVersion: '19.0.0'});
    const eslintRules = await resolveESLintRules(presets);
    const result = compareRules(eslintRules, resolveOxlintRules(config, matcher), withNursery);
    return {...result, files: eslintRules.size};
}

/**
 * @param {string[]} failures
 * @returns {string} the failures, for the message of a failed assertion
 */
function formatFailures(failures) {
    const shown = failures.slice(0, 40).join('\n');
    return `${failures.length} difference(s) between ESLint and oxlint:\n${shown}${failures.length > 40 ? `\n...and ${failures.length - 40} more` : ''}`;
}

for (const name of EXPORTED_PRESETS) {
    test(`the ${name} preset alone runs in oxlint the rules, severities and options ESLint runs`, async (context) => {
        const {failures, compared, files} = await compareRun([name]);

        context.diagnostic(`${compared} entries compared on ${files} files`);
        assert.ok(files > 0, 'ESLint lints no sample file');
        assert.equal(failures.length, 0, formatFailures(failures));
    });
}

test('all the exported presets together run in oxlint the rules, severities and options ESLint runs', async (context) => {
    const {failures, compared, files} = await compareRun(ALL_PRESETS);

    context.diagnostic(`${compared} entries compared on ${files} files`);
    assert.ok(compared >= MIN_COMBINED_ENTRIES, `only ${compared} entries compared`);
    assert.equal(failures.length, 0, formatFailures(failures));
});

test('all the exported presets together with withNursery run in oxlint the rules, severities and options ESLint runs', async (context) => {
    const {failures, compared, files} = await compareRun(ALL_PRESETS, true);

    context.diagnostic(`${compared} entries compared on ${files} files`);
    assert.ok(compared >= MIN_COMBINED_ENTRIES, `only ${compared} entries compared`);
    assert.equal(failures.length, 0, formatFailures(failures));
});
