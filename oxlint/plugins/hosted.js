/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
/**
 * ESLint plugin rules run from their own code under `hosted/`, because oxlint has no version of them or its version
 * reports differently. generated/rules.json lists them. They all load under the one `hosted` name because oxlint keeps
 * most of their plugin names for its own rules. A repo that needs more hosted rules, or wraps these, builds its own
 * plugin named `hosted` from the `rules` of this file and `hostRule` from `eslint-config-expensify/oxlint/utils`, and passes
 * it as `plugins.hosted`.
 */
import {hostedRuleIDsByName} from '../generated-rules.js';
import {definePlugin, hostRule} from '../hosting.js';

const rules = Object.fromEntries([...hostedRuleIDsByName].map(([name, ruleID]) => [name, hostRule(ruleID)]));

const plugin = definePlugin('hosted', rules);

export {rules};
export default plugin;
