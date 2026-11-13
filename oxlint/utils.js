/** What a plugin file needs from this package. Importing it never loads @oxlint/migrate, so plugin files stay quick to load, and index.js re-exports all of it. */
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
