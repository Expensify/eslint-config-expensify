/**
 * Reads generated/rules.json, so the plugins and buildOxlintConfig never run the conversion just to learn which rules
 * run as `core/` and `hosted/`. `npm run build:oxlint` writes the file.
 */
import fs from 'node:fs';

const {coreRuleNames, hostedRuleIDs} = JSON.parse(fs.readFileSync(new URL('./generated/rules.json', import.meta.url), 'utf8'));

export {coreRuleNames, hostedRuleIDs};
