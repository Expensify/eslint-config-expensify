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

We export two ESLint configurations for your usage.

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

## oxlint

`eslint-config-expensify/oxlint` builds an [oxlint](https://oxc.rs) config from the same presets you list in an ESLint config. It runs [`@oxlint/migrate`](https://github.com/oxc-project/oxlint-migrate) on them. Rules oxlint cannot run itself run from ESLint's own code, through two JS plugins named `core` (ESLint core rules) and `hosted` (ESLint plugin rules, as `hosted/<rule>`). The package needs `oxlint` 1.90.x.

Install both tools as dev dependencies next to this package; they are optional peer dependencies, so a repo that only uses the ESLint presets does not get them:

```sh
npm install --save-dev oxlint@1.90.x @oxlint/migrate@1.90.x
```

```js
// oxlint.config.mts
import {defineConfig} from 'oxlint';
import {buildOxlintConfig} from 'eslint-config-expensify/oxlint';

export default defineConfig(
    await buildOxlintConfig({
        presets: ['browser', 'react', 'typescript', {preset: 'jest', files: ['tests/**']}, 'scripts', 'prettier'],
        ignorePatterns: ['dist/**'],
        overrides: [{files: ['**/*.ts'], rules: {'core/no-restricted-syntax': ['error', {selector: 'TSEnumDeclaration', message: 'No enums.'}]}}],
    }),
);
```

It returns one flat config (no `extends`). Plugin files are written as absolute paths, so you can also save the result as JSON anywhere.

Types ship with the package (`oxlint/*.d.mts`, found through the `types` condition of each export), so a TypeScript config file such as `oxlint.config.mts` type-checks without a local declaration file. They import types from `oxlint` and `eslint`.

Options:

- `presets`: names of this package's exports (`browser`, `react`, `typescript`, `jest`, `scripts`, ...) and `'prettier'` for `eslint-config-prettier`. `{preset, files}` limits every block of that preset to `files`.
- `plugins: {hosted, rulesdir}`: your own plugin file in place of ours. It must keep the plugin name. A specifier is an absolute path, a package name, or a path relative to the config file (`'./config/oxlint/plugins/hosted-rules.mjs'`; oxlint resolves it from the directory of the config file, not the working directory; checked with oxlint 1.90). Build the plugin from `hostRule` and the other helpers (exported by `eslint-config-expensify/oxlint` and the lighter `eslint-config-expensify/oxlint/utils`, which never loads `@oxlint/migrate`) and `rules` (exported by `eslint-config-expensify/oxlint/plugins/hosted.mjs` and `.../rulesdir.mjs`). `hostRule(ruleID, pluginRules)` takes the `rules` object of a plugin this package does not list as its second argument, so a repo can host those rules with the same wrappers: `hostRule('storybook/default-exports', storybookPlugin.rules)`.
- `transformRule(ruleID, entry)`: called for each preset rule with its ESLint ID before it is converted. Return `[newRuleID, entry]` to rename it, `null` to drop it, `undefined` to keep the default. React Compiler rules of `eslint-plugin-react-hooks` (`reactCompilerRuleNames`) are kept as `@oxlint/migrate` writes them, as oxlint's own `react/<name>` rules (the three checks oxlint does not implement, `config`, `gating` and `component-hook-factories`, are dropped); return `null` or a new name to change that. A `react-hooks` rule that is neither a compiler rule nor classic stops the build.
- `nativeRules`: ESLint rule IDs from `alwaysHostedRuleIDs` (like `'react-hooks/exhaustive-deps'`) that run with oxlint's own version. Those rules run from ESLint's code as `hosted/` by default, because it reports exactly what ESLint does with ESLint's wording, but a repo may prefer oxlint's faster version. An ID that is not in that list throws.
- `extraRunningNames`: rule names, or prefixes ending in `/`, that your overrides use and the package does not know, like `rc/` or `hosted/require-jsdoc`.
- `ignorePatterns`, `env`, `globals`, `settings`, `jsPlugins`, `overrides`: your own config, merged after the presets. Put rules that run as `core/` or `hosted/` under that name; oxlint's own name for them is rejected with a message.
- `withNursery`: also convert the rules oxlint keeps in its nursery category. `false` by default: those rules run from ESLint's code as `core/` or `hosted/` instead.
- `reactVersion`: found from `react` in the working directory if you leave it out. If a `react` preset is used and the version cannot be found, `buildOxlintConfig` throws.

Other exports: `toEslintRuleID(oxlintCode)` (for example `hosted(exhaustive-deps)` to `react-hooks/exhaustive-deps`), `withEslintDirectiveIDs`, `withEslintDirectiveIDsFor`, `reactCompilerRuleNames`, `coreRuleNames`, `hostedRuleIDs`, `alwaysHostedRuleIDs`, `eslintRuleRenames`. The package exports only `oxlint`, `oxlint/utils` and `oxlint/plugins/{core,hosted,rulesdir}.mjs`.

### Updating the rule list

`oxlint/generated/rules.json` lists which rules run as `core/` and `hosted/`. It depends only on what oxlint supports, so the plugins read it instead of converting the presets each time they load. After you change a preset, `oxlint/tables.mjs` or the `oxlint` version, run `npm run build:oxlint`, check the diff, and commit it. That also rewrites the test snapshots. `npm run test:oxlint` fails when either is out of date.

The React Compiler rule names come from `eslint-plugin-react-hooks` itself: every rule except `rules-of-hooks` and `exhaustive-deps` (see `oxlint/reactCompilerRules.mjs`).

## Style Guide

Feel free to also check out our [Javascript style guide](https://github.com/Expensify/Style-Guides/blob/main/javascript.md), our [general language-agnostic coding standards](https://github.com/Expensify/Style-Guides/blob/main/general.md), and the [ESlint config docs](http://eslint.org/docs/user-guide/configuring#extending-configuration-files) for more information.
