/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
/**
 * Writes oxlint/generated/rules.json: which ESLint rules run as `core/` and `hosted/` in oxlint. That depends on the presets
 * and the oxlint version, so it is computed over every export here, and the plugins read the file. Run `npm run build:oxlint`.
 */
import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {convertPresets} from '../oxlint/convert.js';
import {splitRuleID} from '../oxlint/hosting.js';
import {RULE_SOURCE_LISTS, loadPresetBlocks} from '../oxlint/presets.js';
import {HOSTED_RULES_FOR_REPOS} from '../oxlint/tables.js';

const rulesPath = fileURLToPath(new URL('../oxlint/generated/rules.json', import.meta.url));

/**
 * @returns {Promise<string>} the content oxlint/generated/rules.json should have
 */
async function buildRulesJson() {
    const replayedRuleIDs = new Map();

    // With and without nursery rules: a rule oxlint keeps in nursery runs as `core/` or `hosted/` unless a repo opts in.
    const runs = RULE_SOURCE_LISTS.flatMap(presets => [false, true].map(async withNursery => convertPresets(await loadPresetBlocks(presets), {withNursery})));
    for (const converted of await Promise.all(runs)) {
        for (const [ruleID, target] of converted.replayedRuleIDs) {
            replayedRuleIDs.set(ruleID, target);
        }
    }
    for (const ruleID of HOSTED_RULES_FOR_REPOS) {
        replayedRuleIDs.set(ruleID, `hosted/${splitRuleID(ruleID).name}`);
    }
    const targets = [...replayedRuleIDs];
    const coreRuleNames = targets.filter(([, target]) => target.startsWith('core/')).map(([, target]) => splitRuleID(target).name);
    const hostedRuleIDs = targets.filter(([, target]) => target.startsWith('hosted/')).map(([ruleID]) => ruleID);

    // All hosted rules share the `hosted/` prefix, so the build fails if two plugins bring a rule with the same name.
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
}

export {buildRulesJson, rulesPath};
