import type {Rule} from 'eslint';

/** ESLint rule IDs that run as `hosted/<name>` by default even though oxlint has its own version. `buildOxlintConfig` takes any of them in `nativeRules`. */
export const alwaysHostedRuleIDs: string[];

/** The React Compiler rules of eslint-plugin-react-hooks: every rule except `rules-of-hooks` and `exhaustive-deps`. */
export const reactCompilerRuleNames: string[];

/**
 * Loads one ESLint plugin rule as a hosted rule. `eslint-disable` comments with its ESLint ID apply to it.
 * @param ruleID the ESLint rule ID, like `react/jsx-no-bind`
 * @param pluginRules the `rules` of a plugin this package does not list (like eslint-plugin-storybook)
 */
export function hostRule(ruleID: string, pluginRules?: Record<string, Rule.RuleModule>): Rule.RuleModule;

/**
 * Converts oxlint's name for a finding, like `typescript(no-explicit-any)`, to ESLint's rule ID.
 * @param extra `hostedRules` maps a repo's own `hosted/<name>` rule to its ESLint ID. `pluginPrefixes` maps a repo's own
 * plugin name to an ESLint prefix.
 */
export function toEslintRuleID(code: string, extra?: {hostedRules?: Record<string, string>; pluginPrefixes?: Record<string, string>}): string;

/** Wraps a rule so `eslint-disable` comments that use `eslintRuleId` hide its reports. */
export function withEslintDirectiveIDs(rule: Rule.RuleModule, eslintRuleId: string): Rule.RuleModule;

/** Wraps each rule of `rules`. `toEslintId` maps a rule name to the ESLint ID the comments use. */
export function withEslintDirectiveIDsFor(rules: Record<string, Rule.RuleModule>, toEslintId: (ruleName: string) => string): Record<string, Rule.RuleModule>;

/** An oxlint JS plugin: the rules it brings, under the name in `meta.name`. */
export type OxlintJsPlugin = {meta: {name: string; version: string}; rules: Record<string, Rule.RuleModule>};
