import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(dirname, '..');
const eslintBin = path.join(projectRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');

/**
 * @param {string} configPath
 * @param {string[]} relativeFilePaths
 * @returns {import('eslint').ESLint.LintResult[]}
 */
function runEslint(configPath, relativeFilePaths) {
    const result = spawnSync(
        process.execPath,
        [
            eslintBin,
            '--config',
            configPath,
            '--format',
            'json',
            '--no-ignore',
            '--no-error-on-unmatched-pattern',
            ...relativeFilePaths,
        ],
        {
            cwd: projectRoot,
            encoding: 'utf8',
        },
    );

    if (!result.stdout) {
        throw new Error(result.stderr || `eslint failed with code ${result.status}`);
    }

    return JSON.parse(result.stdout);
}

/**
 * @param {import('eslint').ESLint.LintResult[]} results
 * @param {string} ruleId
 */
function hasRule(results, ruleId) {
    return results.some(fileResult => fileResult.messages.some(message => message.ruleId === ruleId));
}

describe('eslint-config-expensify composability', () => {
    test('@typescript-eslint/no-explicit-any fires on .ts files', () => {
        const results = runEslint(
            path.join(projectRoot, 'eslint.config.js'),
            ['tests/fixtures/sample.ts'],
        );

        expect(hasRule(results, '@typescript-eslint/no-explicit-any')).toBe(true);
    });

    test('JSDoc require-param-type is silent on .ts files', () => {
        const results = runEslint(
            path.join(projectRoot, 'eslint.config.js'),
            ['tests/fixtures/jsdoc-ts.ts'],
        );

        expect(hasRule(results, 'jsdoc/require-param-type')).toBe(false);
        expect(hasRule(results, 'jsdoc/require-param')).toBe(false);
    });

    test('jsdoc/no-types fires on .ts files', () => {
        const results = runEslint(
            path.join(projectRoot, 'eslint.config.js'),
            ['tests/fixtures/jsdoc-ts.ts'],
        );

        expect(hasRule(results, 'jsdoc/no-types')).toBe(true);
    });

    test('es/no-optional-chaining is an error on .js files', () => {
        const results = runEslint(
            path.join(dirname, 'eslint.base-typescript.config.mjs'),
            ['tests/fixtures/optional-chaining.js'],
        );

        expect(hasRule(results, 'es/no-optional-chaining')).toBe(true);
    });

    test('es/no-optional-chaining is silent on .ts files', () => {
        const results = runEslint(
            path.join(dirname, 'eslint.base-typescript.config.mjs'),
            ['tests/fixtures/optional-chaining.ts'],
        );

        expect(hasRule(results, 'es/no-optional-chaining')).toBe(false);
    });

    test('no-console is off in scripts config for scripts paths', () => {
        const results = runEslint(
            path.join(dirname, 'eslint.scripts.config.mjs'),
            ['tests/fixtures/scripts/run.js'],
        );

        expect(hasRule(results, 'no-console')).toBe(false);
    });
});
