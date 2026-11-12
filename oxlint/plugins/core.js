/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
/**
 * ESLint core rules that oxlint cannot run in its default config, run from ESLint's own code under `core/`, so each one
 * behaves as it does in ESLint. oxlint cannot run them for one of these reasons:
 * - It has no version of the rule (most of them).
 * - Its version is experimental (nursery category).
 * - Its only version is the typed `typescript/` one (`dot-notation` and `consistent-return`).
 * - Its replacement reports more than ESLint's deprecated rule (like `no-new-object`).
 *
 * generated/rules.json lists them. `eslint-disable` comments with the ESLint rule name hide their reports.
 */
import {builtinRules} from 'eslint/use-at-your-own-risk';

import {withEslintDirectiveIDsFor} from '../eslint-directives.js';
import {coreRuleNames} from '../generated-rules.js';
import {definePlugin} from '../hosting.js';

const rules = withEslintDirectiveIDsFor(Object.fromEntries(coreRuleNames.map(name => [name, builtinRules.get(name)])), name => name);

const plugin = definePlugin('core', rules);

export default plugin;
