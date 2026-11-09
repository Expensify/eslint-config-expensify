/**
 * The parts of this package a plugin file needs. Importing it never loads @oxlint/migrate, so a repo's own `hosted` or
 * `rulesdir` plugin stays quick to load. `index.mjs` re-exports all of it next to `buildOxlintConfig`.
 */
import {coreRuleNames, hostedRuleIDs} from './generatedRules.mjs';
import {withEslintDirectiveIDs, withEslintDirectiveIDsFor} from './eslintDirectives.mjs';
import {hostRule} from './hosting.mjs';
import {reactCompilerRuleNames} from './reactCompilerRules.mjs';
import {toEslintRuleID} from './ruleNames.mjs';
import {ALWAYS_HOSTED, ESLINT_RULE_RENAMES} from './tables.mjs';

// An array, so callers can list it and use it in JSON.
const alwaysHostedRuleIDs = [...ALWAYS_HOSTED];

export {
    alwaysHostedRuleIDs,
    coreRuleNames,
    ESLINT_RULE_RENAMES as eslintRuleRenames,
    hostedRuleIDs,
    hostRule,
    reactCompilerRuleNames,
    toEslintRuleID,
    withEslintDirectiveIDs,
    withEslintDirectiveIDsFor,
};
