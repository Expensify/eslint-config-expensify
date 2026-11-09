/**
 * Helpers for the oxlint tests: run the oxlint of this package's devDependencies on a config.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const packageDirectory = fileURLToPath(new URL('../../', import.meta.url));
const fixtureDirectory = fileURLToPath(new URL('./fixtures/', import.meta.url));

/**
 * @param {string} [projectDirectory] a project that may have its own node_modules
 * @returns {Record<string, string>} an environment where oxlint finds tsgolint even when the project has no node_modules
 */
function getOxlintEnvironment(projectDirectory = packageDirectory) {
    const tsgolint = require.resolve(`@oxlint-tsgolint/${process.platform}-${process.arch}/tsgolint`, {paths: [projectDirectory, packageDirectory]});
    return {...process.env, OXLINT_TSGOLINT_PATH: tsgolint};
}

/**
 * Creates a temp project that holds a copy of the fixtures and the config as JSON, like a repo that writes the built
 * config to its own folder.
 * @param {string} configJSON
 * @param {Record<string, string>} [extraFiles] more files for the project, by name
 * @returns {string} the directory
 */
function createFixtureProject(configJSON, extraFiles = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expensify-oxlint-'));
    fs.cpSync(fixtureDirectory, directory, {recursive: true});
    fs.writeFileSync(path.join(directory, 'oxlintrc.json'), configJSON);
    for (const [name, content] of Object.entries(extraFiles)) {
        fs.writeFileSync(path.join(directory, name), content);
    }
    return directory;
}

/**
 * Runs oxlint on the fixtures of a project with the config in it.
 * @param {string} directory a project from createFixtureProject
 * @param {string} oxlintBinary
 * @param {Record<string, string>} env
 * @returns {{status: number | null, stderr: string, codes: string[], diagnostics: Array<{code: string, filename: string}>}} the diagnostics, and
 * their codes, like `eslint(eqeqeq)`
 */
function runOxlint(directory, oxlintBinary, env) {
    const result = spawnSync(oxlintBinary, ['-c', 'oxlintrc.json', '--format=json', '.'], {
        cwd: directory, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    let diagnostics = [];
    try {
        diagnostics = JSON.parse(result.stdout).diagnostics.map(({code, filename}) => ({code, filename}));
    } catch {
        // A config error prints no JSON. The caller reports stderr.
    }
    return {
        status: result.status, stderr: `${result.stderr}${result.stdout}`.slice(0, 2000), codes: diagnostics.map(diagnostic => diagnostic.code), diagnostics,
    };
}

export {
    createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
};
