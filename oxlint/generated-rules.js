/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
/**
 * Reads generated/rules.json, so the plugins and buildOxlintConfig never run the conversion just to learn which rules
 * run as `core/` and `hosted/`. `npm run build:oxlint` writes the file.
 */
import fs from 'node:fs';

import {splitRuleID} from './hosting.js';

const {coreRuleNames, hostedRuleIDs} = JSON.parse(fs.readFileSync(new URL('./generated/rules.json', import.meta.url), 'utf8'));

// Each hosted rule's ESLint ID by the name it runs under (`hosted/<name>`), since oxlint gives all of them one plugin name.
const hostedRuleIDsByName = new Map(hostedRuleIDs.map(ruleID => [splitRuleID(ruleID).name, ruleID]));

// How a stale generated/rules.json gets rebuilt. A repo cannot do it itself, so messages name this package.
const REBUILD_RULES_JSON = 'npm run build:oxlint in eslint-config-expensify';

export {
    REBUILD_RULES_JSON, coreRuleNames, hostedRuleIDsByName,
};
