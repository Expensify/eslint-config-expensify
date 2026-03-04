# PR review replies (copy-paste into GitHub)

---

## 1. Reply to: "Why do we need these empty files?"

```
We need these fixture files because RuleTester tests that use `parserOptions.project` (for TypeScript type-aware rules) must pass a filename that exists inside the TypeScript project. The TypeScript program is built from files on disk that match tsconfig `include`; if the path we pass doesn’t point to a real file in that set, `@typescript-eslint/parser` throws "TSConfig does not include this file".

So we can’t delete them: the parser only considers a path “in the project” if the file exists and is included by tsconfig. The files can be minimal (e.g. a short comment); they just need to exist at those paths.

- `test.ts` – used as the linted filename in prefer-at (and similar) tests.
- `test.tsx` – same for rules that need JSX (e.g. boolean-conditional-rendering).
- `file.ts` and `tests/file.ts` – used by prefer-locale-compare-from-context to test both “normal file” and “test file” paths (the rule treats paths under `tests/` differently).

I’ve added JSDoc comments in each fixture explaining this for future readers.
```

---

## 2. Reply to: "Can you link to a specific issue?" + "I'm unlikely to merge this with any existing tests skipped"

```
Done. The boolean-conditional-rendering test is no longer skipped. The "TSConfig does not include this file" issue was fixed by using a dedicated tsconfig for that test: `fixtures/tsconfig.boolean-conditional.json`, which extends the main tsconfig and only includes `test.tsx`. With that, the parser accepts the JSX fixture path and all 25 tests pass. No tests are skipped; the full test suite and lint both pass.
```
