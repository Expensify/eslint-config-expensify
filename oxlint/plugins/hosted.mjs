/**
 * ESLint plugin rules run from their own code under `hosted/`, because oxlint has no version of them or its version
 * reports differently. generated/rules.json lists them. They all load under the one `hosted` name because oxlint keeps
 * most of their plugin names for its own rules. A repo that needs more hosted rules, or wraps these, builds its own
 * plugin named `hosted` from `rules` and `hostRule` and passes it as `plugins.hosted`.
 */
import {hostedRuleIDs} from '../generatedRules.mjs';
import {hostRule, splitRuleID} from '../hosting.mjs';

const rules = Object.fromEntries(hostedRuleIDs.map(ruleID => [splitRuleID(ruleID).name, hostRule(ruleID)]));

const plugin = {
    meta: {
        name: 'hosted',
        version: '0.0.1',
    },
    rules,
};

export {hostRule, rules};
export default plugin;
