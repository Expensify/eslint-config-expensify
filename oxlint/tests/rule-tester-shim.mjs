/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling */
/* eslint-disable no-await-in-loop -- Node-only tooling, and these loops read one file at a time */
/** Helpers for replaying eslint-plugin-expensify's rule tests through oxlint. The replay checks how many diagnostics each case gets, not their lines, columns or messages. */
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

import {lintProject} from './helpers.mjs';

const SPECIFIERS_TO_REPLACE = new Set(['eslint', '@typescript-eslint/rule-tester']);

/**
 * @typedef {object} RecordedCase
 * @property {'valid' | 'invalid'} kind
 * @property {number} index position in the `valid` or `invalid` list of the test
 * @property {string} code
 * @property {string} [filename]
 * @property {number} expected how many errors the case reports, 0 for a valid case
 */

/**
 * @typedef {object} RecordedSuite
 * @property {string} testFile name of the test file, like `no-api-in-views.test.js`
 * @property {string} ruleName the rule's name in rulesdir, which is its file name without `.js`
 * @property {Record<string, any>} languageOptions the options the test gave its RuleTester
 * @property {RecordedCase[]} cases
 */

/** The calls of `ruleTester.run` made by the stand-in RuleTester while a test file loads. */
const recorded = [];

/** Stand-in for the RuleTester of `eslint` and `@typescript-eslint/rule-tester`: remembers the cases instead of running them. */
class RuleTester {
    /** @param {Record<string, any>} [config] */
    constructor(config = {}) {
        this.config = config;
    }

    /**
     * @param {string} name
     * @param {{create: Function}} rule
     * @param {{valid?: Array<string | Record<string, any>>, invalid?: Array<Record<string, any>>}} tests
     */
    run(name, rule, tests) {
        recorded.push({
            name, rule, config: this.config, tests,
        });
    }
}

/**
 * @param {string} ruleDirectory folder that holds the rule files
 * @returns {Promise<Map<Function, string>>} the rule name of every rule file, by its `create` function
 */
async function mapRulesByCreate(ruleDirectory) {
    const byCreate = new Map();
    for (const file of fs.readdirSync(ruleDirectory).filter(name => name.endsWith('.js') && name !== 'CONST.js')) {
        const module = await import(pathToFileURL(path.join(ruleDirectory, file)).href);
        const create = module.create ?? module.default?.create;
        if (typeof create === 'function') {
            byCreate.set(create, file.replace(/\.js$/, ''));
        }
    }
    return byCreate;
}

/**
 * @param {string} testFile
 * @param {'valid' | 'invalid'} kind
 * @param {number} index
 * @param {string | Record<string, any>} testCase a string when it is only code
 * @returns {RecordedCase}
 */
function toRecordedCase(testFile, kind, index, testCase) {
    const {
        code, filename, options, errors,
    } = typeof testCase === 'string' ? {code: testCase} : testCase;
    if (options !== undefined) {
        throw new Error(`${testFile} ${kind}[${index}] has options, which the replay does not pass to the rule`);
    }
    let expected = 0;
    if (kind === 'invalid') {
        expected = typeof errors === 'number' ? errors : errors.length;
    }
    return {
        kind, index, code, filename, expected,
    };
}

/**
 * Loads every test file in a folder with the stand-in RuleTester, which a resolve hook swaps in for their imports.
 * @param {string} testDirectory folder with the `*.test.js` files
 * @param {string} ruleDirectory folder with the rule files the tests import
 * @returns {Promise<RecordedSuite[]>} one suite per `ruleTester.run` call, in file order
 */
async function captureRuleTests(testDirectory, ruleDirectory) {
    const rulesByCreate = await mapRulesByCreate(ruleDirectory);
    const testDirectoryURL = pathToFileURL(`${testDirectory}${path.sep}`).href;
    const hooks = registerHooks({
        resolve(specifier, context, nextResolve) {
            if (SPECIFIERS_TO_REPLACE.has(specifier) && context.parentURL?.startsWith(testDirectoryURL)) {
                return {url: import.meta.url, shortCircuit: true};
            }
            return nextResolve(specifier, context);
        },
    });
    const suites = [];
    try {
        for (const testFile of fs.readdirSync(testDirectory).filter(name => name.endsWith('.test.js')).sort()) {
            recorded.length = 0;

            await import(pathToFileURL(path.join(testDirectory, testFile)).href);
            for (const {
                name, rule, config, tests,
            } of recorded) {
                const ruleName = rulesByCreate.get(rule.create ?? rule.default?.create);
                if (!ruleName) {
                    throw new Error(`${testFile}: the rule tested as "${name}" is not a file in ${ruleDirectory}`);
                }
                suites.push({
                    testFile,
                    ruleName,
                    languageOptions: config.languageOptions ?? {},
                    cases: [
                        ...(tests.valid ?? []).map((testCase, index) => toRecordedCase(testFile, 'valid', index, testCase)),
                        ...(tests.invalid ?? []).map((testCase, index) => toRecordedCase(testFile, 'invalid', index, testCase)),
                    ],
                });
            }
        }
    } finally {
        hooks.deregister();
        recorded.length = 0;
    }
    return suites;
}

/**
 * @param {RecordedSuite} suite
 * @param {RecordedCase} testCase
 * @returns {string} the path in the temp project: its own folder, then the case `filename`, since some rules read the path
 */
function getCasePath(suite, testCase) {
    const folder = `case-${testCase.kind}-${testCase.index}`;
    if (testCase.filename) {
        return path.posix.join(folder, path.posix.normalize(testCase.filename).replace(/^\/+/, ''));
    }
    const usesJSX = !!suite.languageOptions.parserOptions?.ecmaFeatures?.jsx;
    let extension = 'js';
    if (suite.languageOptions.parser) {
        extension = usesJSX ? 'tsx' : 'ts';
    }
    return path.posix.join(folder, `file.${extension}`);
}

/**
 * Lints every case of a suite in one temp project that enables only that rule.
 * @param {RecordedSuite} suite
 * @param {string} pluginSpecifier the rulesdir plugin file
 * @returns {Promise<{results: Map<RecordedCase, Array<{code?: string, message: string}>>, stderr: string}>} the diagnostics of every case
 */
async function replaySuite(suite, pluginSpecifier) {
    const files = {};
    const casesByPath = new Map();
    for (const testCase of suite.cases) {
        const casePath = getCasePath(suite, testCase);
        files[casePath] = testCase.code;
        casesByPath.set(casePath, testCase);
    }
    const {diagnostics, stderr, loaded} = await lintProject({
        plugins: [],
        categories: {correctness: 'off'},
        jsPlugins: [{name: 'rulesdir', specifier: pluginSpecifier}],
        rules: {[`rulesdir/${suite.ruleName}`]: 'error'},
    }, files);
    if (!loaded) {
        throw new Error(`oxlint did not print JSON for ${suite.ruleName}: ${stderr}`);
    }
    const results = new Map(suite.cases.map(testCase => [testCase, []]));
    for (const diagnostic of diagnostics) {
        const testCase = casesByPath.get(diagnostic.filename);
        if (!testCase) {
            throw new Error(`oxlint reported on ${diagnostic.filename}, which is no case of ${suite.testFile}: ${diagnostic.message}`);
        }
        results.get(testCase).push(diagnostic);
    }
    return {results, stderr};
}

export {
    RuleTester, captureRuleTests, replaySuite,
};
