# eslint-config-expensify

[![npm version](https://badge.fury.io/js/eslint-config-expensify.svg)](http://badge.fury.io/js/eslint-config-expensify)

This package provides Expensify's .eslintrc as an extensible shared config. Most of our rules are based on [Airbnb's style guide](https://github.com/airbnb/javascript).

## How to Develop

1. Make a change
2. Bump the version in package.json and submit your PR

### Testing

After  you have submitted a PR with a new version in the `package.json` file

1. Get the full commitID of the last commit in your PR and run `npm install git+https://github.com/Expensify/eslint-config-expensify.git#COMMIT_ID` in the repo against which you want to test those changes.
2. This should update the version of `eslint-config-expensify` in `package-lock.json` file, and ensures the repo is referencing to the correct version of the eslint config.
3. Now, you can run `npm run lint` or perform any other tests you want in that repo.

### After PR is merged
You need to publish the newest version of this to NPM so that we can update it in the other repos
1. From the command line, in the directory for this repo:
1. Run `npm login`
1. Enter username: 'expensify'
1. Enter password: this is in 1Password for npmjs.com
1. Enter the email: infra@expensify.com
1. Ask for the 2FA code in #infra (feel free to ping @ring0 if you don't get a timely response)
1. Run `npm publish`
1. Go into the App, Web-Expensify and Web-Secure repos and run `npm install eslint-config-expensify@latest`. This should update the `package.json` and `package-lock.json` file and you can submit a PR with those changes.

**Note** as of now we have no way of testing these PRs without a separate App, Web or Web Secure PR

## Usage

We export two ESLint configurations for your usage.

### eslint-config-expensify

Our default export contains all of our ESLint rules, including ECMAScript 6+ and React. It requires `eslint`, `eslint-plugin-import`, `eslint-plugin-react`, and `eslint-plugin-jsx-a11y`.

Just add `extends: 'expensify'` to the `.eslintrc` file in the root directory of your project.

### eslint-config-expensify/legacy

Just add `extends: 'expensify/legacy'` to the `.eslintrc` file in the root directory of your project.

## Style Guide

Feel free to also check out our [Javascript style guide](https://github.com/Expensify/Style-Guide/blob/main/javascript.md), our [general language-agnostic coding standards](https://github.com/Expensify/Style-Guide/blob/main/general.md), and the [ESlint config docs](http://eslint.org/docs/user-guide/configuring#extending-configuration-files) for more information.
