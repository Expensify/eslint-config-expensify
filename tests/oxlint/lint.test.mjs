import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {SNAPSHOT_CASES, readRealConfig} from './cases.mjs';
import {
    createFixtureProject, getOxlintEnvironment, packageDirectory, runOxlint,
} from './helpers.mjs';

const oxlintBinary = `${packageDirectory}node_modules/.bin/oxlint`;

for (const name of Object.keys(SNAPSHOT_CASES)) {
    test(`the ${name} config, written as JSON in another folder, loads in oxlint and lints the fixtures`, async () => {
        // Given the config as JSON in a temp project, which is how a repo that writes the built config would use it
        const directory = createFixtureProject(await readRealConfig(name));
        try {
            // When oxlint lints the fixtures
            const {codes, stderr} = runOxlint(directory, oxlintBinary, getOxlintEnvironment());

            // Then the config loads, and rules from oxlint, core, hosted and rulesdir all report
            assert.ok(codes.length > 0, `oxlint did not load the config: ${stderr}`);
            for (const expected of ['eslint(eqeqeq)', 'typescript(dot-notation)', 'hosted(exhaustive-deps)', 'hosted(prefer-default-export)']) {
                assert.ok(codes.includes(expected), `expected ${expected} in ${[...new Set(codes)].join(', ')}`);
            }
            if (name === 'app') {
                assert.ok(codes.includes('rulesdir(no-inline-named-export)'), 'expected a rulesdir report');
            }
        } finally {
            fs.rmSync(directory, {recursive: true, force: true});
        }
    });
}
