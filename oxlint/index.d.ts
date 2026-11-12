import type {OxlintConfig} from 'oxlint';

export * from './utils.js';

/**
 * A preset name of this package (or `'prettier'`), or an object that runs the preset on `files` only. Blocks for file
 * types (typescript, browser, node) keep them inside `files`, like ESLint's `defineConfig({files, extends})`. Other blocks
 * get `files` instead of their own, like `{...block, files}`. `react` cannot be limited to `files`: it sets settings that
 * oxlint cannot scope to files, so the build throws.
 */
export type PresetEntry = string | {preset: string; files: string[]};

/**
 * Called for each preset rule with its ESLint rule ID before it is converted. Return `[newRuleID, entry]` to write the
 * rule under another name (the name is used as written), `null` to drop it, or `undefined` for the default handling.
 */
export type TransformRule = (ruleID: string, entry: unknown) => [string, unknown] | null | undefined;

export type BuildOxlintConfigOptions = {

    /** The presets to convert, in order: names of this package's exports, and `'prettier'`. */
    presets: PresetEntry[];

    /**
     * Plugin files that replace this package's `hosted` and `rulesdir` plugins. Absolute paths, package names, or paths
     * relative to the config file.
     */
    plugins?: {hosted?: string; rulesdir?: string};

    /** Called for each preset rule before it is converted, to rename or drop it. */
    transformRule?: TransformRule;

    /** Also convert the rules oxlint keeps in its nursery category. False by default. */
    withNursery?: boolean;

    /** ESLint rule IDs from `alwaysHostedRuleIDs` that run with oxlint's own version instead of the hosted copy. */
    nativeRules?: string[];

    /** Rule names, or prefixes ending in `/`, that `overrides` may use and this package does not know. */
    extraRunningNames?: string[];

    /**
     * The React version for oxlint's react rules. By default it is read from the `react` installed next to this package,
     * then from the working directory. Required if the `react` preset is used and neither has it.
     */
    reactVersion?: string;

    /** Added after the presets' patterns. */
    ignorePatterns?: OxlintConfig['ignorePatterns'];

    /** Merged over the presets' env. */
    env?: OxlintConfig['env'];

    /** Merged over the presets' globals. */
    globals?: OxlintConfig['globals'];

    /** Merged into the presets' settings, key by key. */
    settings?: OxlintConfig['settings'];

    /** Added after the plugins of the presets. */
    jsPlugins?: OxlintConfig['jsPlugins'];

    /** Added after the presets' overrides, so they win. A rule that runs as `hosted/` or `core/` must be written with that name. */
    overrides?: OxlintConfig['overrides'];
};

/** A rule's severity, as ESLint config writes it. */
export type RuleSeverity = 'off' | 'warn' | 'error' | 0 | 1 | 2;

/**
 * Returns a copy of the preset's setting for a rule as `[severity, ...options]`, merged over the preset's blocks as ESLint
 * does. Which files a block is for is ignored. Use it so an override can extend the setting, since an override replaces
 * the whole setting. `Options` types the options, which the package cannot know, like `[Record<string, unknown>]`.
 */
export function getPresetRuleEntry<Options extends unknown[] = unknown[]>(preset: string, ruleID: string): Promise<[RuleSeverity, ...Options]>;

/** Builds one flat oxlint config (no `extends`) from eslint-config-expensify presets plus the repo's own settings. */
export function buildOxlintConfig(options: BuildOxlintConfigOptions): Promise<OxlintConfig>;
