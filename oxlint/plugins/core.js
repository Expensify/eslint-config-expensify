/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
/**
 * ESLint core rules that oxlint cannot run in its default config (it has no version, only a nursery or typed one, or a replacement
 * that reports more than ESLint), run from ESLint's own code under `core/`. generated/rules.json lists them, and `eslint-disable`
 * comments with the ESLint rule name hide their reports.
 */
import {builtinRules} from 'eslint/use-at-your-own-risk';

import {withEslintDirectiveIDsFor} from '../eslint-directives.js';
import {coreRuleNames} from '../generated-rules.js';
import {definePlugin} from '../hosting.js';

const rules = withEslintDirectiveIDsFor(Object.fromEntries(coreRuleNames.map(name => [name, builtinRules.get(name)])), name => name);

const plugin = definePlugin('core', rules);

export default plugin;
