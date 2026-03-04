/**
 * Fixture file for ESLint RuleTester tests that use parserOptions.project.
 * When RuleTester runs with a TypeScript project, the linted "file" must be inside
 * that project; we pass filename: path.join(tsconfigRootDir, 'test.ts') so the
 * parser includes this file. The file must exist and be listed in tsconfig include.
 */
