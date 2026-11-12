# eslint-config-expensify

[![npm version](https://badge.fury.io/js/eslint-config-expensify.svg)](http://badge.fury.io/js/eslint-config-expensify)

This package provides Expensify's `.eslintrc` as an extensible shared config. Most of our rules are based on [Airbnb's style guide](https://github.com/airbnb/javascript).

## How to Develop

1. You only need to make a PR with the changes. There is no need to bump the version in `package.json` file in your PR. A github action will automatically bump the version and publish the package to npm after PR is merged.

### Testing

After you have submitted a PR,

1. Get the full commitID of the last commit in your PR, and run `npm install git+https://github.com/Expensify/eslint-config-expensify.git#COMMIT_ID` in the repo against which you want to test those changes.
2. This should update the resolved path of `eslint-config-expensify` in `package-lock.json` file, and ensures the repo is referencing to the correct local version of the eslint config.
3. Now, you can run `npm run lint` or perform any other tests you want in that repo.

### After PR is merged
1. A GitHub action will automatically bump the version and publish the package to npm after PR is merged.
1. Go into the App, Web-Expensify and Web-Secure repos and run `npm install eslint-config-expensify@latest -E`. This should update the `package.json` and `package-lock.json` file, and you can submit a PR with those changes.

**Note** as of now we have no way of testing these PRs without a separate App, Web or Web-Secure PR

## Usage

This package exports ESLint configurations (the default one below and opt-in presets like `jest`), and an [oxlint config builder](#oxlint) that converts the same presets.

### eslint-config-expensify

Our default export contains all of our ESLint rules, including ECMAScript 6+ and React. It requires `eslint`, `eslint-plugin-import`, `eslint-plugin-react`, and `eslint-plugin-jsx-a11y`.

Just add `extends: 'expensify'` to the `.eslintrc` file in the root directory of your project.

### eslint-config-expensify/legacy

Just add `extends: 'expensify/legacy'` to the `.eslintrc` file in the root directory of your project.

### eslint-config-expensify/jest

Opt-in config for Jest test, mock, and setup files. Enables Jest globals, `eslint-plugin-jest` recommended and style rules, relaxes `no-console`, `no-await-in-loop`, and `no-import-assign` for test files, and allows the `@jest-environment` JSDoc tag via `jsdoc/check-tag-names`.

```js
import {defineConfig} from 'eslint/config';
import expensifyConfig from 'eslint-config-expensify';
import jestConfig from 'eslint-config-expensify/jest';

export default defineConfig([
    ...expensifyConfig,
    ...jestConfig,
]);
```

## Oxlint

`eslint-config-expensify/oxlint` builds an [oxlint](https://oxc.rs) config from the same presets you would list in an ESLint config, so a repo can lint with oxlint without copying any rules. Rules oxlint cannot run itself still run, from ESLint's own code, as `core/<rule>` (ESLint core rules) and `hosted/<rule>` (ESLint plugin rules).

Install oxlint, `@oxlint/migrate`, `oxlint-tsgolint` and `oxc-parser` (which the hosted `import/*` rules use to read imported modules) next to this package. They are optional peer dependencies, so repos that only use the ESLint presets do not get them. Supported versions: `oxlint` and `@oxlint/migrate` `>=1.90.0 <2`, `oxc-parser` `>=0.147.0 <1`, `oxlint-tsgolint` `>=7.0.2005 <8`.

```sh
npm install --save-dev oxlint @oxlint/migrate oxlint-tsgolint oxc-parser
```

```js
// oxlint.config.mts
import {buildOxlintConfig} from 'eslint-config-expensify/oxlint';

export default await buildOxlintConfig({
    presets: ['browser', 'react', 'typescript', {preset: 'jest', files: ['tests/**']}, 'scripts', 'prettier'],
    ignorePatterns: ['dist/**'],
    overrides: [{files: ['**/*.ts'], rules: {'core/no-restricted-syntax': ['error', {selector: 'TSEnumDeclaration', message: 'No enums.'}]}}],
});
```

Options:

- `presets`: this package's exports (`browser`, `react`, `typescript`, `jest`, `scripts`, ...) plus `'prettier'` to turn off formatting rules. `{preset, files}` runs a preset on `files` only, as you would write it in an ESLint config:
    - `jest`, `scripts` and other presets whose blocks target locations: `files` replaces the block's own `files`, like `{...block, files}`. For example `{preset: 'jest', files: ['tests/**']}` runs the jest rules on everything in `tests/`.
    - `typescript`, `browser` and `node`, whose blocks target file types: each block keeps its file types inside `files`, like ESLint's `defineConfig({files, extends: [preset]})`. For example `{preset: 'typescript', files: ['src/**']}` runs the TS rules on `src/**/*.ts` (and `.tsx`, `.mts`, `.cts`) and the JS rules on `src/**/*.js` and the like. Their `files` must be folders (`dir/**`) or name a file type (`dir/**/*.ts`, `src/foo-*.d.ts`, `setup.js`): a file name with wildcards must end with a plain extension, so `src/*` and `src/index.*` are refused.
    - `react` cannot be limited to files: it sets settings (like `propWrapperFunctions`) that oxlint applies to every file, so the build throws.
- `ignorePatterns`, `env`, `globals`, `settings`, `jsPlugins`, `overrides`: the repo's own config, applied after the presets. A rule that runs as `core/` or `hosted/` must be written with that prefix; the build says so if it is not.
- `plugins: {hosted, rulesdir}`: a repo's own plugin file in place of ours, for example to add rules or wrap one. Build it from the `rules` exported by `eslint-config-expensify/oxlint/plugins/hosted` and `.../rulesdir`, and `hostRule()` from `eslint-config-expensify/oxlint/utils`.
- `transformRule(ruleID, entry)`: rename (`[newID, entry]`) or drop (`null`) a preset rule before it is converted.
- `nativeRules`: rules from `alwaysHostedRuleIDs` (like `react-hooks/exhaustive-deps`) to run with oxlint's own version instead of ESLint's.
- `extraRunningNames`: rule names or prefixes ending in `/` (like `rc/`) that the repo's own plugins add.
- `withNursery`: also use oxlint's experimental (nursery) rules where it has them. `import/export` always uses oxlint's version.
- `reactVersion`: only needed when `react` cannot be found from the repo.

An override replaces a rule's whole setting, so a bare severity like `'no-console': 'warn'` drops the preset's options instead of keeping them as ESLint does. To extend a preset's options instead of copying them, start from `await getPresetRuleEntry(preset, ruleID)`. It returns a copy of the preset's setting as `[severity, ...options]`, merged over the preset's blocks as ESLint does. Settings that turn the rule off are skipped, so for a rule a later block of the preset turns off, it still returns the last setting that turned it on. It ignores which files a block is for, so give the override the files the setting belongs to:

```js
import {buildOxlintConfig, getPresetRuleEntry} from 'eslint-config-expensify/oxlint';

const [severity, ...options] = await getPresetRuleEntry('typescript', '@typescript-eslint/naming-convention');

// The typescript preset sets this rule for TS files only, so the override names TS files too.
export default await buildOxlintConfig({
    presets: ['browser', 'typescript'],
    overrides: [{files: ['tests/**/*.ts'], rules: {'hosted/naming-convention': [severity, ...options, {selector: 'objectLiteralProperty', format: null}]}}],
});
```

`toEslintRuleID()` turns oxlint's name for a finding, like `hosted(exhaustive-deps)`, back into the ESLint rule ID, so baselines of known findings keep using ESLint IDs. `eslint-disable` comments with ESLint IDs work for `core/` and `hosted/` rules too.

Unused `eslint-disable` comments are not reported, although the presets ask for it (`reportUnusedDisableDirectives`). Turning the check on would also flag comments that do hide a `core/` or `hosted/` finding, because `oxlint/eslint-directives.js` removes those findings before oxlint sees them. The check can be enabled once repos use oxlint-style disable comments and that file is removed.

### Changing rules

Edit the presets as usual. After any change to a preset, to `oxlint/tables.js` or to the oxlint version, run `npm run build:oxlint` and commit what it changes: `oxlint/generated/rules.json` (which rules run as `core/` or `hosted/`). Run `npm run test:oxlint` to check the oxlint side; `npm test` does not include it.

If the build stops with "oxlint cannot run <rule>", the message names the table in `oxlint/tables.js` to add the rule to: run it from its ESLint plugin, use an oxlint rule in its place, or drop it with a reason. Rules that need type information can only be replaced or dropped, or run with stubbed parser services (`STUBBED_PARSER_SERVICES`) when they use types only for options the presets do not set.

## Style Guide

Feel free to also check out our [Javascript style guide](https://github.com/Expensify/Style-Guides/blob/main/javascript.md), our [general language-agnostic coding standards](https://github.com/Expensify/Style-Guides/blob/main/general.md), and the [ESlint config docs](http://eslint.org/docs/user-guide/configuring#extending-configuration-files) for more information.
