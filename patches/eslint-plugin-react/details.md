# `eslint-plugin-react` patches

### [eslint-plugin-react+7.37.5.patch](../eslint-plugin-react+7.37.5.patch)

- Reason:

  ```
  ESLint 10 removed context.getFilename() and context.getSourceCode() in favor of
  context.filename and context.sourceCode. This patch adds fallbacks so the plugin
  works with both ESLint 9 and 10 (context.filename ?? context.getFilename?.() and
  context.sourceCode ?? context.getSourceCode?.()) in lib/util/version.js,
  lib/rules/jsx-filename-extension.js, and lib/rules/forward-ref-uses-ref.js.
  ```

- Upstream issue: https://github.com/jsx-eslint/eslint-plugin-react/issues/3977
- Upstream PR: https://github.com/jsx-eslint/eslint-plugin-react/pull/3979
