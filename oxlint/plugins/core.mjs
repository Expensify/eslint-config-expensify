/**
 * ESLint core rules oxlint has no version of, run from ESLint's own code under `core/`, so each one behaves as it does
 * under ESLint. generated/rules.json lists them. `eslint-disable` comments with the ESLint rule name hide their reports.
 */
import {builtinRules} from 'eslint/use-at-your-own-risk';

import {withEslintDirectiveIDsFor} from '../eslintDirectives.mjs';
import {coreRuleNames} from '../generatedRules.mjs';

const rules = withEslintDirectiveIDsFor(Object.fromEntries(coreRuleNames.map(name => [name, builtinRules.get(name)])), name => name);

const plugin = {
    meta: {
        name: 'core',
        version: '0.0.1',
    },
    rules,
};

export {rules};
export default plugin;
