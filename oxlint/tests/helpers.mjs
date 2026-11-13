/* eslint-disable es/no-optional-chaining, rulesdir/prefer-underscore-method -- Node-only tooling, so optional chaining and native array methods are fine */
/**
 * Helpers for the oxlint tests: build a temp project from a config and files, and run an oxlint binary on it.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const packageDirectory = fileURLToPath(new URL('../../', import.meta.url));

// Every preset the package exports, by file name in configs/public.
const EXPORTED_PRESETS = fs.readdirSync(new URL('../../configs/public/', import.meta.url)).map(file => file.replace(/\.js$/, '')).sort();

// All of them in one list, like a repo that uses every export, with eslint-config-prettier last. The order matters: the
// conversion refuses an unscoped block that follows a scoped one for the same rule (`formatting` before `typescript`), and
// a later block that sets only a severity keeps the options of an earlier one. An export missing from the order goes last.
const PRESET_ORDER = ['browser', 'node', 'expensify', 'formatting', 'react', 'react-formatting', 'typescript', 'scripts', 'jest'];
const ALL_PRESETS = [...PRESET_ORDER, ...EXPORTED_PRESETS.filter(name => !PRESET_ORDER.includes(name)), 'prettier'];

/**
 * @param {string} [projectDirectory] a project that may have its own node_modules
 * @returns {Record<string, string>} an environment where oxlint finds tsgolint even when the project has no node_modules
 */
function getOxlintEnvironment(projectDirectory = packageDirectory) {
    const tsgolint = require.resolve(`@oxlint-tsgolint/${process.platform}-${process.arch}/tsgolint`, {paths: [projectDirectory, packageDirectory]});
    return {...process.env, OXLINT_TSGOLINT_PATH: tsgolint};
}

/**
 * Creates a temp project that holds the config as JSON and the given files, like a repo that writes the built config to
 * its own folder.
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
 * Runs oxlint on the files of a project with the config in it.
 * @param {string} directory a project from createFixtureProject
 * @param {string} oxlintBinary
 * @param {Record<string, string>} env
 * @returns {{status: number | null, loaded: boolean, stderr: string, codes: string[], diagnostics: Array<{code: string, filename: string, message: string, line?: number}>}}
 * the diagnostics, and their codes, like `eslint(eqeqeq)`. `loaded` is false when oxlint rejected the config, which prints no JSON
 */
function runOxlint(directory, oxlintBinary, env) {
    const result = spawnSync(oxlintBinary, ['-c', 'oxlintrc.json', '--format=json', '.'], {
        cwd: directory, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error) {
        throw new Error(`Could not run oxlint at ${oxlintBinary}: ${result.error.message}`, {cause: result.error});
    }
    let diagnostics = [];
    let loaded = false;
    try {
        diagnostics = JSON.parse(result.stdout).diagnostics.map(({
            code, filename, message, labels,
        }) => ({
            code, filename, message, line: labels?.[0]?.span?.line,
        }));
        loaded = true;
    } catch {
        // A config error prints no JSON. The caller reports stderr.
    }
    return {
        status: result.status, loaded, stderr: `${result.stderr}${result.stdout}`.slice(0, 2000), codes: diagnostics.map(diagnostic => diagnostic.code), diagnostics,
    };
}

export {
    ALL_PRESETS, EXPORTED_PRESETS, createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
};
