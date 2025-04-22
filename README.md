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
1. Go into the App, Web-Expensify and Web-Secure repos and run `npm install eslint-config-expensify@latest`. This should update the `package.json` and `package-lock.json` file, and you can submit a PR with those changes.

**Note** as of now we have no way of testing these PRs without a separate App, Web or Web-Secure PR

## Usage

We export two ESLint configurations for your usage.

### eslint-config-expensify

Our default export contains all of our ESLint rules, including ECMAScript 6+ and React. It requires `eslint`, `eslint-plugin-import`, `eslint-plugin-react`, and `eslint-plugin-jsx-a11y`.

Just add `extends: 'expensify'` to the `.eslintrc` file in the root directory of your project.

### eslint-config-expensify/legacy

Just add `extends: 'expensify/legacy'` to the `.eslintrc` file in the root directory of your project.

## Style Guide

Feel free to also check out our [Javascript style guide](https://github.com/Expensify/Style-Guides/blob/main/javascript.md), our [general language-agnostic coding standards](https://github.com/Expensify/Style-Guides/blob/main/general.md), and the [ESlint config docs](http://eslint.org/docs/user-guide/configuring#extending-configuration-files) for more information.
