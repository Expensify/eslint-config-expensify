/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators, rulesdir/prefer-underscore-method -- Node-only tooling, so modern syntax and native array methods are fine */
/* eslint-disable no-await-in-loop -- Node-only tooling, and these loops read one file at a time */
/**
 * Helpers for replaying the cases of eslint-plugin-expensify's rule tests through oxlint. `captureRuleTests` loads the
 * test files with a stand-in for RuleTester that records every `ruleTester.run(...)` call instead of running ESLint. The
 * other functions turn a recorded case into a file of a temp project, run oxlint on that project, and compare what oxlint
 * reported with what the ESLint test expects.
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Loaded before the hooks below exist, so the test files cannot swap it for the stand-in.
import {Linter} from 'eslint';

const SPECIFIERS_TO_REPLACE = new Set(['eslint', '@typescript-eslint/rule-tester']);

/**
 * @typedef {object} RecordedCase
 * @property {'valid' | 'invalid'} kind
 * @property {number} index position in the `valid` or `invalid` list of the test
 * @property {string} code
 * @property {string} [filename] the `filename` of the case
 * @property {Array<string | {message?: string, messageId?: string, data?: Record<string, unknown>, line?: number, column?: number}> | number} [errors]
 */

/**
 * @typedef {object} RecordedSuite
 * @property {string} testFile name of the test file, like `no-api-in-views.test.js`
 * @property {string} ruleName the rule's name in rulesdir, which is its file name without `.js`
 * @property {{create: Function, meta?: {messages?: Record<string, string>}}} rule
 * @property {Record<string, any>} languageOptions the options the test gave its RuleTester
 * @property {RecordedCase[]} cases
 */

/**
 * @typedef {object} ExpectedError
 * @property {number} line
 * @property {number} [column]
 * @property {string} message
 */

/** The suites recorded by the stand-in RuleTester while a test file loads. */
const recorded = [];

/**
 * Stand-in for the RuleTester of `eslint` and `@typescript-eslint/rule-tester`: remembers the cases instead of running them.
 */
class RuleTester {
    /**
     * @param {Record<string, any>} [config] the options the test gave its RuleTester
     */
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
 * Loads every test file in a folder with the stand-in RuleTester, without running any test. The test files are not edited:
 * a resolve hook sends their `eslint` and `@typescript-eslint/rule-tester` imports to this file for as long as they load.
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
                    rule,
                    languageOptions: config.languageOptions ?? {},
                    cases: [
                        ...(tests.valid ?? []).map((testCase, index) => ({kind: 'valid', index, ...(typeof testCase === 'string' ? {code: testCase} : testCase)})),
                        ...(tests.invalid ?? []).map((testCase, index) => ({kind: 'invalid', index, ...testCase})),
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
 * @param {string} template a message of `meta.messages`, with `{{name}}` placeholders
 * @param {Record<string, unknown>} [data]
 * @returns {string | undefined} the message, or undefined when a placeholder has no value in the data
 */
function fillMessage(template, data = {}) {
    let missing = false;
    const message = template.replaceAll(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, key) => {
        if (!(key in data)) {
            missing = true;
            return '';
        }
        return String(data[key]);
    });
    return missing ? undefined : message;
}

/**
 * @param {RecordedSuite} suite
 * @param {RecordedCase} testCase
 * @returns {string} where the case goes in the temp project: its own folder, so cases never share a file. A `filename` of
 * the case is kept below that folder, since some rules read the path
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
 * Runs the rule with ESLint's Linter, to read the lines and messages of a case that does not spell them out.
 * @param {RecordedSuite} suite
 * @param {RecordedCase} testCase
 * @returns {Array<{line: number, column: number, message: string}>}
 */
function lintWithESLint(suite, testCase) {
    const ruleID = `rulesdir/${suite.ruleName}`;

    // The base folder is the root, so a `filename` like `/src/components/Test.js` is inside it. Type information is not
    // needed for the rules replayed here, so a parser that asks for a project gets plain parsing.
    const {
        project, projectService, tsconfigRootDir, ...parserOptions
    } = suite.languageOptions.parserOptions ?? {};
    const messages = new Linter({cwd: '/'}).verify(
        testCase.code,
        [
            {
                files: ['**'],
                languageOptions: {...suite.languageOptions, parserOptions},
                plugins: {rulesdir: {rules: {[suite.ruleName]: suite.rule}}},
                rules: {[ruleID]: 'error'},
            },
        ],
        {filename: `/${getCasePath(suite, testCase).replace(/^case-[a-z]+-\d+\//, '')}`},
    );
    const fatal = messages.find(message => message.fatal);
    if (fatal) {
        throw new Error(`ESLint could not lint ${suite.testFile} ${testCase.kind}[${testCase.index}]: ${fatal.message}`);
    }
    return messages.filter(message => message.ruleId === ruleID).map(({line, column, message}) => ({line, column, message}));
}

/**
 * What the ESLint test expects of a case. A case that gives only an error count, or an error without a line, takes its
 * lines (and messages) from an ESLint run on the same snippet.
 * @param {RecordedSuite} suite
 * @param {RecordedCase} testCase
 * @returns {ExpectedError[]} one entry per error, in report order, empty for a valid case
 */
function getExpectedErrors(suite, testCase) {
    if (testCase.kind === 'valid') {
        return [];
    }

    // ESLint also takes a message as a string in place of an error object.
    const given = typeof testCase.errors === 'number'
        ? Array.from({length: testCase.errors}, () => ({}))
        : testCase.errors.map(error => (typeof error === 'string' ? {message: error} : error));
    const messages = given.map((error) => {
        const template = error.messageId ? suite.rule.meta?.messages?.[error.messageId] : undefined;
        return error.message ?? (template === undefined ? undefined : fillMessage(template, error.data));
    });

    // A message that cannot be filled in (data the test leaves out) is read from ESLint too, so no case is left unchecked.
    const needsESLint = given.some((error, position) => error.line === undefined || messages[position] === undefined);
    const derived = needsESLint ? lintWithESLint(suite, testCase) : [];
    if (needsESLint && derived.length !== given.length) {
        throw new Error(`${suite.testFile} ${testCase.kind}[${testCase.index}] expects ${given.length} errors but ESLint's Linter gave ${derived.length}`);
    }
    return given.map((error, position) => ({
        line: error.line ?? derived[position].line,
        ...(error.column === undefined ? {} : {column: error.column}),
        message: messages[position] ?? derived[position].message,
    }));
}

/**
 * Runs oxlint on a folder and parses its JSON output.
 * @param {string} oxlintBinary
 * @param {string} directory
 * @param {Record<string, string>} env
 * @returns {Promise<{diagnostics: Array<{code?: string, filename: string, message: string, line?: number, column?: number, offset?: number}>, stderr: string}>}
 */
function runOxlintAsync(oxlintBinary, directory, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(oxlintBinary, ['-c', 'oxlintrc.json', '--format=json', '.'], {cwd: directory, env});
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8').on('data', (chunk) => {
            stdout += chunk;
        });
        child.stderr.setEncoding('utf8').on('data', (chunk) => {
            stderr += chunk;
        });
        child.on('error', error => reject(new Error(`Could not run oxlint at ${oxlintBinary}: ${error.message}`, {cause: error})));
        child.on('close', () => {
            try {
                const {diagnostics} = JSON.parse(stdout);
                resolve({
                    stderr,
                    diagnostics: diagnostics.map(({
                        code, filename, message, labels,
                    }) => ({
                        code, filename, message, line: labels?.[0]?.span?.line, column: labels?.[0]?.span?.column, offset: labels?.[0]?.span?.offset,
                    })),
                });
            } catch {
                reject(new Error(`oxlint did not print JSON in ${directory}: ${`${stderr}${stdout}`.slice(0, 2000)}`));
            }
        });
    });
}

/**
 * Writes every case of a suite into a temp project that enables only that rule, runs oxlint on it once, and sorts the
 * diagnostics by case.
 * @param {RecordedSuite} suite
 * @param {{oxlintBinary: string, env: Record<string, string>, pluginSpecifier: string}} options `pluginSpecifier` is the
 * file of the rulesdir plugin
 * @returns {Promise<{results: Map<RecordedCase, {diagnostics: Array<{code?: string, message: string, line?: number, column?: number}>}>, stderr: string}>}
 * the diagnostics of every case, in report order
 */
async function replaySuite(suite, {oxlintBinary, env, pluginSpecifier}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-rule-replay-'));
    try {
        fs.writeFileSync(
            path.join(directory, 'oxlintrc.json'),
            JSON.stringify({
                plugins: [],
                categories: {correctness: 'off'},
                jsPlugins: [{name: 'rulesdir', specifier: pluginSpecifier}],
                rules: {[`rulesdir/${suite.ruleName}`]: 'error'},
            }),
        );
        const casesByPath = new Map();
        for (const testCase of suite.cases) {
            const casePath = getCasePath(suite, testCase);
            fs.mkdirSync(path.dirname(path.join(directory, casePath)), {recursive: true});
            fs.writeFileSync(path.join(directory, casePath), testCase.code);
            casesByPath.set(casePath, testCase);
        }
        const {diagnostics, stderr} = await runOxlintAsync(oxlintBinary, directory, env);
        const results = new Map(suite.cases.map(testCase => [testCase, {diagnostics: []}]));
        for (const diagnostic of diagnostics) {
            const testCase = casesByPath.get(diagnostic.filename);
            if (!testCase) {
                throw new Error(`oxlint reported on ${diagnostic.filename}, which is no case of ${suite.testFile}: ${diagnostic.message}`);
            }
            results.get(testCase).diagnostics.push(diagnostic);
        }
        for (const {diagnostics: found} of results.values()) {
            found.sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));
        }
        return {results, stderr};
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
}

/**
 * @param {Array<{line?: number, column?: number, message?: string}>} errors
 * @returns {string}
 */
function formatErrors(errors) {
    if (!errors.length) {
        return 'nothing';
    }
    return errors.map(({line, column, message}) => `line ${line}${column === undefined ? '' : `:${column}`}${message === undefined ? '' : ` "${message}"`}`).join('; ');
}

/**
 * Compares what oxlint reported for a case with what the ESLint test expects: the count, the line of every error, the
 * column and message where the test gives them.
 * @param {RecordedSuite} suite
 * @param {RecordedCase} testCase
 * @param {{diagnostics: Array<{code?: string, message: string, line?: number, column?: number}>}} result
 * @returns {string | undefined} the description of the difference, or undefined when oxlint matches the test
 */
function compareCase(suite, testCase, result) {
    const code = `rulesdir(${suite.ruleName})`;
    const actual = result.diagnostics.filter(diagnostic => diagnostic.code === code);
    const unrelated = result.diagnostics.filter(diagnostic => diagnostic.code !== code);
    const header = [
        `${suite.ruleName} ${testCase.kind}[${testCase.index}] (${suite.testFile})`,
        `  code: ${JSON.stringify(testCase.code)}`,
        ...(testCase.filename ? [`  filename: ${testCase.filename}`] : []),
    ];
    let expected;
    try {
        expected = getExpectedErrors(suite, testCase);
    } catch (error) {
        return [...header, `  the expected errors could not be read from ESLint: ${error.message}`, `  oxlint: ${formatErrors(actual)}`].join('\n');
    }
    const problems = [];
    if (unrelated.length) {
        problems.push(`oxlint also reported ${unrelated.map(({code: other, message}) => `${other ?? 'a parse error'}: ${message}`).join('; ')}`);
    }
    if (actual.length !== expected.length) {
        problems.push(`count: expected ${expected.length}, oxlint gave ${actual.length}`);
    } else {
        for (const [position, error] of expected.entries()) {
            if (actual[position].line !== error.line) {
                problems.push(`error ${position} line: expected ${error.line}, oxlint gave ${actual[position].line}`);
            }
            if (error.column !== undefined && actual[position].column !== error.column) {
                problems.push(`error ${position} column: expected ${error.column}, oxlint gave ${actual[position].column}`);
            }
            if (error.message !== undefined && actual[position].message !== error.message) {
                problems.push(`error ${position} message: expected "${error.message}", oxlint gave "${actual[position].message}"`);
            }
        }
    }
    if (!problems.length) {
        return undefined;
    }
    return [
        ...header,
        `  expected: ${formatErrors(expected)}`,
        `  oxlint: ${formatErrors(actual)}`,
        ...problems.map(problem => `  ${problem}`),
    ].join('\n');
}

export {
    RuleTester, captureRuleTests, compareCase, getCasePath, getExpectedErrors, replaySuite,
};
