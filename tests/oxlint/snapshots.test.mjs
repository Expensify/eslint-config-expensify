import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {buildRulesJson, rulesPath} from '../../scripts/build-oxlint.mjs';
import {SNAPSHOT_CASES, buildSnapshot, snapshotPath} from './cases.mjs';

for (const name of Object.keys(SNAPSHOT_CASES)) {
    test(`buildOxlintConfig output for the ${name} presets matches the snapshot`, async () => {
        // Given the preset list a repo uses
        // When the config is built
        const actual = await buildSnapshot(name);

        // Then it is the committed one, so a change to the conversion shows up in review (npm run build:oxlint rewrites it)
        assert.equal(actual, fs.readFileSync(snapshotPath(name), 'utf8'), `Run npm run build:oxlint to update ${snapshotPath(name)} after checking the change`);
    });
}

test('generated/rules.json is up to date', async () => {
    // Given the committed list of core and hosted rules
    // When it is rebuilt from the presets
    const rebuilt = await buildRulesJson();

    // Then nothing changed, so the plugins host every rule the presets need
    assert.equal(fs.readFileSync(rulesPath, 'utf8'), rebuilt, 'Run npm run build:oxlint');
});
