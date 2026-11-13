/** Hand-made decisions the conversion in convert.js cannot derive. */

// ESLint plugins whose rules can run as `hosted/<rule>`. oxlint keeps the names react, import, jsdoc, @typescript-eslint
// and react-hooks for its own rules, so a JS plugin cannot use them.
const HOSTED_PLUGIN_PACKAGES = {
    react: 'eslint-plugin-react',
    import: 'eslint-plugin-import',
    jsdoc: 'eslint-plugin-jsdoc',
    '@typescript-eslint': '@typescript-eslint/eslint-plugin',
    'react-hooks': 'eslint-plugin-react-hooks',
};

// Rules that run from ESLint's code as `hosted/<name>`, even though oxlint has its own version.
const ALWAYS_HOSTED = new Set([
    // oxlint's version reports on a different line than ESLint's, and skips `export type {...}`.
    'import/prefer-default-export',

    // oxlint's version also reports components defined inside `jest.mock()` factories.
    'react/function-component-definition',

    // oxlint's version reports on the JSX provider instead of the value.
    'react/jsx-no-constructed-context-values',

    // With the native version, an `eslint-disable` comment also hides every React Compiler error in that component
    // (https://github.com/oxc-project/oxc/issues/26277). The hosted copy does not, and a repo can filter its useCallback
    // and useMemo reports by ESLint's message text. A repo can still pick the native version with `nativeRules`.
    'react-hooks/exhaustive-deps',
]);

// Rules in oxlint's nursery category that run as oxlint's own version even without `withNursery`. The native import/export
// misses names that two `export * from` modules both export, which ESLint's version reports. That is accepted, and it keeps
// these rules off the hosted path, which would need a parser for the modules they read.
const NURSERY_RULES_RUN_NATIVE = new Set(['import/export', 'import/named']);

// Hosted rules a repo can switch on itself though no preset enables them in the lists rules.json is built from. oxlint has no
// import resolution rule of its own, and TypeScript repos turn this one on for their TypeScript files.
const HOSTED_RULES_FOR_REPOS = ['import/no-unresolved'];

// Preset rules that do not run at all, and why.
const DROPPED_RULES = {
    'no-invalid-this': 'calls sourceCode.getJSDocComment, which oxlint JS plugins do not support, and the error drops every other JS plugin report in the file',
    'react/jsx-uses-react': 'only marks variables as used; oxlint no-unused-vars handles JSX itself (checked: same reports with and without it)',
    'react/jsx-uses-vars': 'only marks variables as used; oxlint no-unused-vars handles JSX itself (checked: same reports with and without it)',
    'react-hooks/component-hook-factories': 'React Compiler check that oxlint does not implement',
    'react-hooks/config': 'React Compiler check that oxlint does not implement',
    'react-hooks/gating': 'React Compiler check that oxlint does not implement',
    'rulesdir/boolean-conditional-rendering': 'needs the type of the `&&` left operand, and JS plugins get no type information',
};

// Preset rules that do not run unless the repo sets `withNursery`, because oxlint keeps its version in the nursery
// category and the ESLint version needs type information.
const DROPPED_WITHOUT_NURSERY = {
    '@typescript-eslint/prefer-optional-chain': 'needs type information, and the native rule is still in nursery',
};

// oxlint rules used instead of preset rules that need type information. unicorn/prefer-at keeps its default options,
// because `checkAllIndexAccess` would also flag reads like `result[0]`.
const STAND_INS = {
    'rulesdir/prefer-at': 'unicorn/prefer-at',
};

// oxlint's versions of these rules take no options and fail to load if given ESLint's, so the options are dropped:
// - jsx-no-duplicate-props `ignoreCase`: `className` and `classname` on one element are no longer reported as duplicates.
// - jsx-no-undef `allowGlobals`: a global used as a JSX tag (`<Intl.Foo />`) is reported as undefined.
const DROP_OPTIONS = new Set(['react/jsx-no-duplicate-props', 'react/jsx-no-undef']);

// Core rules @oxlint/migrate writes as their typescript-eslint versions, on every file, when it runs with type
// information. ESLint runs the core rule unless the typescript preset swaps it, so the type-aware run does not get them.
const TYPED_CORE_EQUIVALENTS = new Set(['consistent-return', 'dot-notation']);

/**
 * @param {string} key a settings key of a preset
 * @returns {boolean} whether convert.js copies it into the oxlint config: the `import/*` settings ESLint's import rules
 * read, except `import/parsers`, which oxlint does not have
 */
const isCopiedImportSetting = key => key.startsWith('import/') && key !== 'import/parsers';

// `import/*` settings a preset sets for some files only, which convert.js still applies to every file: oxlint has no
// per-file settings. Each one is checked to give the same result on every file.
const MERGED_IMPORT_SETTINGS = {
    'import/external-module-folders': 'only tells whether a resolved path is inside one of the folders, and every path in node_modules/@types is also in node_modules',
};

// naming-convention is marked as needing type information, which oxlint JS plugins do not get. It only uses types for
// options that set `types`, which the presets do not, so the hosted copy gets empty parser services.
const STUBBED_PARSER_SERVICES = new Set(['@typescript-eslint/naming-convention']);

// @oxlint/migrate warnings that are safe to ignore: the parser, the added globals, and the react version buildOxlintConfig sets.
const EXPECTED_WARNINGS = [/^special parser detected: @babel\/eslint-parser$/, /^react\.version "detect"/, /^Added \d+ globals/];

// Warnings about settings oxlint cannot take are safe only when every dropped key is an `import/*` one (restored from the
// presets by convert.js) or has the value ESLint uses by default anyway.
const DROPPED_SETTINGS_WARNINGS = [/^Settings not migrated/, /^Settings found under a 'files' pattern/];
const DEFAULT_SETTINGS = {'react.pragma': 'React'};

// Plugin prefixes that oxlint writes differently from ESLint, as `oxlint prefix: ESLint prefix`. A repo may use the oxlint
// form in its overrides.
const ESLINT_PREFIX_OF = {eslint: '', 'import-x': 'import', typescript: '@typescript-eslint'};

export {
    ALWAYS_HOSTED,
    DEFAULT_SETTINGS,
    DROPPED_RULES,
    DROPPED_SETTINGS_WARNINGS,
    DROPPED_WITHOUT_NURSERY,
    DROP_OPTIONS,
    ESLINT_PREFIX_OF,
    EXPECTED_WARNINGS,
    HOSTED_PLUGIN_PACKAGES,
    HOSTED_RULES_FOR_REPOS,
    MERGED_IMPORT_SETTINGS,
    NURSERY_RULES_RUN_NATIVE,
    isCopiedImportSetting,
    STAND_INS,
    STUBBED_PARSER_SERVICES,
    TYPED_CORE_EQUIVALENTS,
};
