/* eslint-disable es/no-optional-chaining, rulesdir/prefer-underscore-method -- Node-only tooling, so optional chaining and native array methods are fine */
/**
 * Helpers for the oxlint tests: build a temp project from a config and files, and run an oxlint binary on it.
 */
import {execFile, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildOxlintConfig} from '../index.js';

const require = createRequire(import.meta.url);
const packageDirectory = fileURLToPath(new URL('../../', import.meta.url));

// Every preset the package exports, by file name in configs/public.
const EXPORTED_PRESETS = fs.readdirSync(new URL('../../configs/public/', import.meta.url)).map(file => file.replace(/\.js$/, '')).sort();

// All of them in one list, like a repo that uses every export, with eslint-config-prettier last. The order matters: the
// conversion refuses an unscoped block that follows a scoped one for the same rule (`formatting` before `typescript`), and
// a later block that sets only a severity keeps the options of an earlier one. An export missing from the order goes last.
const PRESET_ORDER = ['browser', 'node', 'expensify', 'formatting', 'react', 'react-formatting', 'typescript', 'scripts', 'jest'];
const ALL_PRESETS = [...PRESET_ORDER, ...EXPORTED_PRESETS.filter(name => !PRESET_ORDER.includes(name)), 'prettier'];

// buildOxlintConfig looks for react where this package is installed before the working directory, so a react above this
// checkout would hide the one the tests give it
const REACT_RESOLVES_FROM_CHECKOUT = (() => {
    try {
        require.resolve('react/package.json', {paths: [packageDirectory]});
        return true;
    } catch {
        return false;
    }
})();

/**
 * @returns {Record<string, string>} an environment where oxlint finds tsgolint even when the project has no node_modules
 */
function getOxlintEnvironment() {
    const tsgolint = require.resolve(`@oxlint-tsgolint/${process.platform}-${process.arch}/tsgolint`, {paths: [packageDirectory]});
    return {...process.env, OXLINT_TSGOLINT_PATH: tsgolint};
}

/**
 * Creates a temp project that holds the config as JSON and the given files.
 * @param {string} configJSON
 * @param {Record<string, string>} [files] the files of the project, by name
 * @returns {string} the directory
 */
function createFixtureProject(configJSON, files = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-'));
    fs.writeFileSync(path.join(directory, 'oxlintrc.json'), configJSON);
    for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(directory, name)), {recursive: true});
        fs.writeFileSync(path.join(directory, name), content);
    }
    return directory;
}

/**
 * Runs the action with the directory as the working directory, then restores the previous one. The working directory belongs to
 * the whole process, so no other work may run at the same time.
 * @template T
 * @param {string} directory
 * @param {() => Promise<T>} action
 * @returns {Promise<T>}
 */
async function inWorkingDirectory(directory, action) {
    const previous = process.cwd();
    process.chdir(directory);
    try {
        return await action();
    } finally {
        process.chdir(previous);
    }
}

/**
 * Like buildOxlintConfig, in a temp directory with a react 19.0.0 installed, since this package does not have react.
 * @param {Parameters<typeof buildOxlintConfig>[0]} options
 * @returns {ReturnType<typeof buildOxlintConfig>}
 */
async function buildConfigWithReact(options) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-react-'));
    try {
        fs.mkdirSync(path.join(directory, 'node_modules/react'), {recursive: true});
        fs.writeFileSync(path.join(directory, 'node_modules/react/package.json'), JSON.stringify({name: 'react', version: '19.0.0'}));
        return await inWorkingDirectory(directory, () => buildOxlintConfig(options));
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
}

const OXLINT_ARGUMENTS = ['-c', 'oxlintrc.json', '--format=json', '.'];
const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * @param {number | null} status
 * @param {string} stdout
 * @param {string} stderr
 * @returns {{status: number | null, loaded: boolean, stderr: string, codes: string[], diagnostics: Array<{code: string, filename: string, message: string, line?: number}>}}
 * the diagnostics, and their codes, like `eslint(eqeqeq)`. `loaded` is false when oxlint rejected the config, which prints no JSON
 */
function parseOxlintOutput(status, stdout, stderr) {
    let diagnostics = [];
    let loaded = false;
    try {
        diagnostics = JSON.parse(stdout).diagnostics.map(({
            code, filename, message, labels,
        }) => ({
            code, filename, message, line: labels?.[0]?.span?.line,
        }));
        loaded = true;
    } catch {
        // A config error prints no JSON. The caller reports stderr.
    }
    return {
        status, loaded, stderr: `${stderr}${stdout}`.slice(0, 2000), codes: diagnostics.map(diagnostic => diagnostic.code), diagnostics,
    };
}

/**
 * Runs oxlint on the files of a project with the config in it.
 * @param {string} directory a project from createFixtureProject
 * @param {string} oxlintBinary
 * @param {Record<string, string>} env
 * @returns {ReturnType<typeof parseOxlintOutput>}
 */
function runOxlint(directory, oxlintBinary, env) {
    const result = spawnSync(oxlintBinary, OXLINT_ARGUMENTS, {
        cwd: directory, env, encoding: 'utf8', maxBuffer: MAX_BUFFER,
    });
    if (result.error) {
        throw new Error(`Could not run oxlint at ${oxlintBinary}: ${result.error.message}`, {cause: result.error});
    }
    return parseOxlintOutput(result.status, result.stdout, result.stderr);
}

/**
 * Like runOxlint, without blocking, so several projects can be linted at once.
 * @param {string} directory
 * @param {string} oxlintBinary
 * @param {Record<string, string>} env
 * @returns {Promise<ReturnType<typeof parseOxlintOutput>>}
 */
function runOxlintAsync(directory, oxlintBinary, env) {
    return new Promise((resolve, reject) => {
        execFile(oxlintBinary, OXLINT_ARGUMENTS, {cwd: directory, env, maxBuffer: MAX_BUFFER}, (error, stdout, stderr) => {
            // A number is the exit code (1 when oxlint reports), anything else means oxlint did not start
            if (error && typeof error.code !== 'number') {
                reject(new Error(`Could not run oxlint at ${oxlintBinary}: ${error.message}`, {cause: error}));
                return;
            }
            resolve(parseOxlintOutput(error ? error.code : 0, stdout, stderr));
        });
    });
}

export {
    ALL_PRESETS,
    EXPORTED_PRESETS,
    REACT_RESOLVES_FROM_CHECKOUT,
    buildConfigWithReact,
    createFixtureProject,
    getOxlintEnvironment,
    inWorkingDirectory,
    packageDirectory,
    runOxlint,
    runOxlintAsync,
};
