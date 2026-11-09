/**
 * The preset lists the snapshots and tests build configs for: the App's, and react-native-onyx's.
 */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

import {buildOxlintConfig} from '../../oxlint/index.mjs';

const packageDirectory = fileURLToPath(new URL('../../', import.meta.url));
const snapshotDirectory = fileURLToPath(new URL('./__snapshots__/', import.meta.url));

// The jest preset applies to react-native-onyx's test and mock files only.
const ONYX_JEST_FILES = ['tests/**', 'lib/**/__mocks__/**', 'jestSetup.js', 'jest-sequencer.js', 'jest-test-environment.ts'];

// `reactVersion` is set so the snapshot does not depend on the react version installed here.
const SNAPSHOT_CASES = {
    app: {presets: ['browser', 'react', 'expensify', 'typescript', 'scripts', 'jest', 'prettier'], reactVersion: '19.0.0'},
    onyx: {presets: ['browser', 'react', 'typescript', {preset: 'jest', files: ONYX_JEST_FILES}, 'scripts', 'prettier'], reactVersion: '19.0.0'},
};

/**
 * Builds a case's config. Absolute paths into this package are written as `<package>`, so the snapshot is the same on
 * every machine.
 * @param {keyof typeof SNAPSHOT_CASES} name
 * @returns {Promise<string>} the snapshot text
 */
async function buildSnapshot(name) {
    const config = await buildOxlintConfig(SNAPSHOT_CASES[name]);
    return `${JSON.stringify(config, null, 2).replaceAll(packageDirectory.replace(/\/$/, ''), '<package>')}\n`;
}

/**
 * @param {string} name
 * @returns {string} where the case's snapshot is committed
 */
const snapshotPath = name => `${snapshotDirectory}${name}.json`;

/**
 * @param {string} name
 * @returns {Promise<string>} the snapshot with `<package>` turned back into this package's path, as oxlint can load it
 */
async function readRealConfig(name) {
    return fs.readFileSync(snapshotPath(name), 'utf8').replaceAll('<package>', packageDirectory.replace(/\/$/, ''));
}

export {
    SNAPSHOT_CASES, buildSnapshot, readRealConfig, snapshotPath,
};
