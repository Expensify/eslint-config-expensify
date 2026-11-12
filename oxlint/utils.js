/**
 * The parts of this package a plugin file needs. Importing it never loads @oxlint/migrate, so a repo's own `hosted` or
 * `rulesdir` plugin stays quick to load. `index.js` re-exports all of it next to `buildOxlintConfig`.
 */
import {withEslintDirectiveIDs, withEslintDirectiveIDsFor} from './eslint-directives.js';
import {hostRule} from './hosting.js';
import {reactCompilerRuleNames} from './react-compiler-rules.js';
import {toEslintRuleID} from './rule-names.js';
import {ALWAYS_HOSTED} from './tables.js';

// An array, so callers can list it and use it in JSON.
const alwaysHostedRuleIDs = [...ALWAYS_HOSTED];

export {
    alwaysHostedRuleIDs,
    hostRule,
    reactCompilerRuleNames,
    toEslintRuleID,
    withEslintDirectiveIDs,
    withEslintDirectiveIDsFor,
};
