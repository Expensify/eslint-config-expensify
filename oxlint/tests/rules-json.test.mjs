import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

import {buildRulesJson, rulesPath} from '../../scripts/build-oxlint.js';

test('generated/rules.json is up to date', async () => {
    // Given the committed list of core and hosted rules
    // When it is rebuilt from every preset the package exports
    const rebuilt = await buildRulesJson();

    // Then nothing changed, so the plugins host every rule the presets need
    assert.equal(fs.readFileSync(rulesPath, 'utf8'), rebuilt, 'Run npm run build:oxlint');
});
