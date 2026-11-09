import type {Rule} from 'eslint';

export const rules: Record<string, Rule.RuleModule>;
declare const plugin: {meta: {name: string; version: string}; rules: Record<string, Rule.RuleModule>};
export default plugin;
