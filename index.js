const path = require("path");
const rulesDirPlugin = require("eslint-plugin-rulesdir");

rulesDirPlugin.RULES_DIR = path.resolve(__dirname, "eslint-plugin-expensify");

module.exports = {
  plugins: ["@lwc/eslint-plugin-lwc", "eslint-plugin-es", "rulesdir"],
  extends: [
    "airbnb",
    require.resolve("./rules/style"),
    require.resolve("./rules/es6"),
    require.resolve("./rules/react"),
    "plugin:react-hooks/recommended",
    require.resolve("./rules/expensify"),
  ],
  env: {
    browser: true,
    es6: true,
    jquery: true,
    node: true,
  },
  parser: "babel-eslint",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    ecmaFeatures: {
      generators: true,
      objectLiteralDuplicateProperties: true,
    },
  },
};
