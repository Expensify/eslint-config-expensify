/**
 * Rewrites the committed snapshots of buildOxlintConfig (tests/oxlint/__snapshots__). Run by `npm run build:oxlint`.
 */
import fs from 'node:fs';

import {SNAPSHOT_CASES, buildSnapshot, snapshotPath} from '../tests/oxlint/cases.mjs';

for (const name of Object.keys(SNAPSHOT_CASES)) {
    fs.writeFileSync(snapshotPath(name), await buildSnapshot(name));
    process.stdout.write(`wrote ${snapshotPath(name)}\n`);
}
