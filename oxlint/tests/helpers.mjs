/* eslint-disable es/no-optional-chaining, rulesdir/prefer-underscore-method -- Node-only tooling */
/** Helpers for the oxlint tests: lint a temp project with a config, build a config where react is installed, and list the presets. */
import {execFile} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildOxlintConfig} from '../index.js';

const require = createRequire(import.meta.url);
const packageDirectory = fileURLToPath(new URL('../../', import.meta.url));
const OXLINT_BINARY = `${packageDirectory}node_modules/.bin/oxlint`;

const EXPORTED_PRESETS = fs.readdirSync(new URL('../../configs/public/', import.meta.url)).map(file => file.replace(/\.js$/, '')).sort();

// All of them in one list, like a repo that uses every export, with prettier last. The conversion refuses an unscoped block that
// follows a scoped one for the same rule, so `formatting` goes before `typescript`.
const PRESET_ORDER = ['browser', 'node', 'expensify', 'formatting', 'react', 'react-formatting', 'typescript', 'scripts', 'jest'];
const ALL_PRESETS = [...PRESET_ORDER, ...EXPORTED_PRESETS.filter(name => !PRESET_ORDER.includes(name)), 'prettier'];

// buildOxlintConfig looks where this package is installed before the working directory, so a react above this checkout would hide the tests' react
const SKIP_WHEN_REACT_IN_CHECKOUT = (() => {
    try {
        require.resolve('react/package.json', {paths: [packageDirectory]});
        return 'react resolves from this checkout';
    } catch {
        return false;
    }
})();

/**
 * Like buildOxlintConfig, in a temp directory with react 19.0.0 installed (unless `react` is false), since this package does not have react.
 * It changes the working directory of the process, so no other work may run at the same time.
 * @param {Parameters<typeof buildOxlintConfig>[0]} options
 * @param {{react?: boolean}} [project]
 * @returns {ReturnType<typeof buildOxlintConfig>}
 */
async function buildConfigInProject(options, {react = true} = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-react-'));
    const previous = process.cwd();
    try {
        if (react) {
            fs.mkdirSync(path.join(directory, 'node_modules/react'), {recursive: true});
            fs.writeFileSync(path.join(directory, 'node_modules/react/package.json'), JSON.stringify({name: 'react', version: '19.0.0'}));
        }
        process.chdir(directory);
        return await buildOxlintConfig(options);
    } finally {
        process.chdir(previous);
        fs.rmSync(directory, {recursive: true, force: true});
    }
}

/**
 * Runs oxlint on a project that has an oxlintrc.json, without blocking, so several projects can be linted at once.
 * @param {string} directory
 * @returns {Promise<{status: number, loaded: boolean, stderr: string, diagnostics: Array<{code: string, filename: string, message: string, line?: number}>}>}
 * the diagnostics, with codes like `eslint(eqeqeq)`. `loaded` is false when oxlint rejected the config, which prints no JSON
 */
function runOxlint(directory) {
    return new Promise((resolve, reject) => {
        // Lets oxlint find tsgolint even when the project has no node_modules
        const tsgolint = require.resolve(`@oxlint-tsgolint/${process.platform}-${process.arch}/tsgolint`, {paths: [packageDirectory]});
        const env = {...process.env, OXLINT_TSGOLINT_PATH: tsgolint};
        execFile(OXLINT_BINARY, ['-c', 'oxlintrc.json', '--format=json', '.'], {cwd: directory, env, maxBuffer: 64 * 1024 * 1024}, (error, stdout, stderr) => {
            // A number is the exit code (1 when oxlint reports), anything else means oxlint did not start
            if (error && typeof error.code !== 'number') {
                reject(new Error(`Could not run oxlint at ${OXLINT_BINARY}: ${error.message}`, {cause: error}));
                return;
            }
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
                // A config error prints no JSON
            }
            resolve({
                status: error ? error.code : 0, loaded, stderr: `${stderr}${stdout}`.slice(0, 2000), diagnostics,
            });
        });
    });
}

/**
 * Lints a temp project that holds the config and the files, then removes it.
 * @param {Record<string, unknown>} config the contents of oxlintrc.json
 * @param {Record<string, string>} files the files of the project, by name
 * @returns {ReturnType<typeof runOxlint>}
 */
async function lintProject(config, files) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-'));
    try {
        fs.writeFileSync(path.join(directory, 'oxlintrc.json'), JSON.stringify(config));
        for (const [name, content] of Object.entries(files)) {
            fs.mkdirSync(path.dirname(path.join(directory, name)), {recursive: true});
            fs.writeFileSync(path.join(directory, name), content);
        }
        return await runOxlint(directory);
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
}

export {
    ALL_PRESETS,
    EXPORTED_PRESETS,
    SKIP_WHEN_REACT_IN_CHECKOUT,
    buildConfigInProject,
    lintProject,
    packageDirectory,
};
