import type {OxlintConfig} from 'oxlint';

export * from './utils.mjs';

/** A preset name of this package (or `'prettier'`), or an object that limits every block of the preset to `files`. */
export type PresetEntry = string | {preset: string; files: string[]};

/**
 * Called for each preset rule with its ESLint rule ID before it is converted. Return `[newRuleID, entry]` to write the
 * rule under another name, `null` to drop it, or `undefined` for the default handling.
 */
export type TransformRule = (ruleID: string, entry: unknown) => [string, unknown] | null | undefined;

export type BuildOxlintConfigOptions = {
    /** The presets to convert, in order: names of this package's exports, and `'prettier'`. */
    presets: PresetEntry[];

    /** Plugin files that replace this package's `hosted` and `rulesdir` plugins. Absolute paths, package names, or paths relative to the config file. */
    plugins?: {hosted?: string; rulesdir?: string};
    transformRule?: TransformRule;

    /** Also convert the rules oxlint keeps in its nursery category. False by default. */
    withNursery?: boolean;

    /** Rule names, or prefixes ending in `/`, that `overrides` may use and this package does not know. */
    extraRunningNames?: string[];

    /** The React version for oxlint's react rules. Found from the working directory by default, and required if the `react` preset is used. */
    reactVersion?: string;
    ignorePatterns?: OxlintConfig['ignorePatterns'];
    env?: OxlintConfig['env'];
    globals?: OxlintConfig['globals'];
    settings?: OxlintConfig['settings'];
    jsPlugins?: OxlintConfig['jsPlugins'];
    overrides?: OxlintConfig['overrides'];
};

/** Builds one flat oxlint config (no `extends`) from eslint-config-expensify presets plus the repo's own settings. */
export function buildOxlintConfig(options: BuildOxlintConfigOptions): Promise<OxlintConfig>;
