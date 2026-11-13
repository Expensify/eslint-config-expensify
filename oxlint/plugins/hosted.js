/* eslint-disable rulesdir/prefer-underscore-method -- Node-only tooling, so native array methods are fine */
/**
 * ESLint plugin rules run from their own code under `hosted/`, because oxlint has no version of them or its version reports
 * differently. generated/rules.json lists them, and they share one `hosted` name since oxlint keeps most plugin names for its own
 * rules. A repo that adds or wraps hosted rules builds its own `hosted` plugin from `rules` and `hostRule` (oxlint/utils) and
 * passes it as `plugins.hosted`.
 */
import {hostedRuleIDsByName} from '../generated-rules.js';
import {definePlugin, hostRule} from '../hosting.js';

const rules = Object.fromEntries([...hostedRuleIDsByName].map(([name, ruleID]) => [name, hostRule(ruleID)]));

const plugin = definePlugin('hosted', rules);

export {rules};
export default plugin;
