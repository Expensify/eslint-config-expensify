import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {buildRulesJson, rulesPath} from '../../scripts/build-oxlint.js';

test('generated/rules.json is up to date', async () => {
    const rebuilt = await buildRulesJson();

    // A stale file would leave a rule the presets need without a plugin to host it
    assert.equal(fs.readFileSync(rulesPath, 'utf8'), rebuilt, 'Run npm run build:oxlint');
});
