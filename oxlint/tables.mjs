/**
 * The decisions the conversion in convert.mjs needs and cannot derive: which ESLint plugins can host rules, which rules
 * always run from ESLint's code, which are dropped, and which warnings of @oxlint/migrate are safe.
 */

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

    // An `eslint-disable` comment for the native version also hides every React Compiler error in that component
    // (https://github.com/oxc-project/oxc/issues/26277). The hosted copy also lets a repo gate its useCallback and
    // useMemo reports by ESLint's message wording.
    'react-hooks/exhaustive-deps',
]);

// Preset rules that do not run at all, and why.
const DROPPED_RULES = {
    'no-invalid-this': 'calls sourceCode.getJSDocComment, which oxlint JS plugins do not support, and the error drops every JS plugin report in the file',
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

// oxlint rules used instead of preset rules that need type information. unicorn/prefer-at keeps its default options;
// `checkAllIndexAccess` would also flag reads like `result[0]`.
const STAND_INS = {
    'rulesdir/prefer-at': 'unicorn/prefer-at',
};

// oxlint's versions of these rules accept no options and fail to load when given ESLint's.
const DROP_OPTIONS = new Set(['react/jsx-no-duplicate-props', 'react/jsx-no-undef']);

// ESLint's deprecated core rule names, and the names oxlint runs them under.
const ESLINT_RULE_RENAMES = {
    'no-new-object': 'no-object-constructor',
    'no-new-symbol': 'no-new-native-nonconstructor',
};

// naming-convention is marked as needing type information, which oxlint JS plugins do not get. It only uses types for
// options that set `types`, which the presets do not, so the hosted copy gets empty parser services.
const STUBBED_PARSER_SERVICES = new Set(['@typescript-eslint/naming-convention']);

// @oxlint/migrate warnings that are safe to ignore: the parser, globals, and the react version, which buildOxlintConfig
// sets itself.
const EXPECTED_WARNINGS = [/^special parser detected: @babel\/eslint-parser$/, /^react\.version "detect"/, /^Added \d+ globals/];

// Warnings about settings oxlint cannot take are safe only when every dropped key is an `import/*` one (restored from the
// presets by convert.mjs) or has the value ESLint uses by default anyway.
const DROPPED_SETTINGS_WARNINGS = [/^Settings not migrated/, /^Settings found under a 'files' pattern/];
const DEFAULT_SETTINGS = {'react.pragma': 'React'};

// oxlint also accepts these prefixes for rules it runs under another plugin name (oxlint prefix: ESLint prefix).
const ESLINT_PREFIX_OF = {eslint: '', 'import-x': 'import', typescript: '@typescript-eslint'};

export {
    ALWAYS_HOSTED,
    DEFAULT_SETTINGS,
    DROPPED_RULES,
    DROPPED_SETTINGS_WARNINGS,
    DROPPED_WITHOUT_NURSERY,
    DROP_OPTIONS,
    ESLINT_PREFIX_OF,
    ESLINT_RULE_RENAMES,
    EXPECTED_WARNINGS,
    HOSTED_PLUGIN_PACKAGES,
    STAND_INS,
    STUBBED_PARSER_SERVICES,
};
