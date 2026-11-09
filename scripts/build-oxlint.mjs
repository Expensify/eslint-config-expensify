/**
 * Writes oxlint/generated/rules.json: which ESLint rules run as `core/` and `hosted/` in oxlint. That depends only on
 * what oxlint supports, so it is computed once over every export of this package, and the plugins read the
 * file instead of running the conversion each time they load. Then it rewrites the test snapshots (in a second process,
 * because they read the new rules.json).
 *
 *     npm run build:oxlint
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {convertPresets} from '../oxlint/convert.mjs';
import {splitRuleID} from '../oxlint/hosting.mjs';
import {RULE_SOURCE_LISTS, loadPresetBlocks} from '../oxlint/presets.mjs';

const rulesPath = fileURLToPath(new URL('../oxlint/generated/rules.json', import.meta.url));

/**
 * @returns {Promise<string>} the content oxlint/generated/rules.json should have
 */
async function buildRulesJson() {
    const replayedRuleIDs = new Map();
    for (const presets of RULE_SOURCE_LISTS) {
        const converted = await convertPresets(await loadPresetBlocks(presets));
        for (const [ruleID, target] of converted.replayedRuleIDs) {
            replayedRuleIDs.set(ruleID, target);
        }
    }
    const targets = [...replayedRuleIDs];
    const coreRuleNames = targets.filter(([, target]) => target.startsWith('core/')).map(([, target]) => target.slice('core/'.length));
    const hostedRuleIDs = targets.filter(([, target]) => target.startsWith('hosted/')).map(([ruleID]) => ruleID);

    // All hosted rules share the `hosted/` prefix, so loading fails if two plugins bring a rule with the same name.
    const names = hostedRuleIDs.map(ruleID => splitRuleID(ruleID).name);
    const duplicate = names.find((name, index) => names.indexOf(name) !== index);
    if (duplicate) {
        throw new Error(`Two hosted rules would both be named hosted/${duplicate}`);
    }
    return `${JSON.stringify({coreRuleNames: coreRuleNames.sort(), hostedRuleIDs: hostedRuleIDs.sort()}, null, 2)}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    fs.writeFileSync(rulesPath, await buildRulesJson());
    process.stdout.write(`wrote ${rulesPath}\n`);
    execFileSync(process.execPath, [fileURLToPath(new URL('./write-oxlint-snapshots.mjs', import.meta.url))], {stdio: 'inherit'});
}

export {buildRulesJson, rulesPath};
