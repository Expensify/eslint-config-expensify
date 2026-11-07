# Component ordering autofix: App experiment

The conservative autofix is implemented in `eslint-plugin-expensify/component-body-order.js` and was run with **only that rule enabled** across App in a separate worktree.

- Branch: `experiment/component-order-autofix`
- Base: `df1e765feee11ea8983554979da24405a4b39411`
- Result: [`9ad1d868fc789b93e1f5a622421a3745b457bb86`](https://github.com/Expensify/App/commit/9ad1d868fc789b93e1f5a622421a3745b457bb86)
- [Full before/after diff](https://github.com/Expensify/App/compare/df1e765feee11ea8983554979da24405a4b39411...9ad1d868fc789b93e1f5a622421a3745b457bb86)
- **11,408 files scanned; 124 files changed; 799 lines moved in each direction.** There were 1,631 remaining ordering warnings after fixing. A second whole-repo fix made no further changes.

The initial broader trial changed 139 files. Review prompted tighter handling of function objects that can be mutated or escape through unknown calls; the final branch was regenerated from its base with those restrictions. The primary App checkout was not used for edits.

## What autofix does

It orders eligible declarations according to the existing category preference while preserving hook order. The automatically movable units are complete single-binding `const` arrow/function declarations and primitive-literal computations. It does not execute or pull work out of function bodies.

Calls, getters, array/object constructions, mutation chains, uncertain aliases, captured/early binding references, comments, lint directives, and control-flow boundaries block fixes. Function-property operations and passing a function object to an unknown call also block movement. Tests cover automatic-semicolon-insertion boundaries and direct `eval`, including TypeScript wrappers.

The result is primarily a readability experiment. **Source-level safety constraints do not guarantee better compiler bookkeeping.** OXC results below show both directions, so this is not a recommendation to deploy the entire branch for performance.

## Showcase 1: LegalNameStep — clearer setup and one fewer cache

[Before](https://github.com/Expensify/App/blob/df1e765feee11ea8983554979da24405a4b39411/src/pages/AddPersonalBankAccountPage/substeps/LegalNameStep.tsx#L21-L36) · [After](https://github.com/Expensify/App/blob/9ad1d868fc789b93e1f5a622421a3745b457bb86/src/pages/AddPersonalBankAccountPage/substeps/LegalNameStep.tsx#L21-L36)

Before, the default-value helper separated the subscription hooks from the submit hook:

```tsx
const [privatePersonalDetails] = useOnyx(ONYXKEYS.PRIVATE_PERSONAL_DETAILS);

const getDefaultValues = () => ({
    firstName: privatePersonalDetails?.legalFirstName ?? '',
    lastName: privatePersonalDetails?.legalLastName ?? '',
});

const handleSubmit = usePersonalBankAccountDetailsFormSubmit({
    fieldIds: STEP_FIELDS,
    onNext,
    shouldSaveDraft: isEditing,
});

const defaultValues = getDefaultValues();
```

After, the hooks are together and the helper sits immediately beside its use:

```tsx
const [privatePersonalDetails] = useOnyx(ONYXKEYS.PRIVATE_PERSONAL_DETAILS);

const handleSubmit = usePersonalBankAccountDetailsFormSubmit({
    fieldIds: STEP_FIELDS,
    onNext,
    shouldSaveDraft: isEditing,
});

const getDefaultValues = () => ({
    firstName: privatePersonalDetails?.legalFirstName ?? '',
    lastName: privatePersonalDetails?.legalLastName ?? '',
});

const defaultValues = getDefaultValues();
```

OXC consolidates helper creation and invocation into one cached scope: **21 → 19 cache slots, 6 → 5 guards**. Both versions already cache the result. The actual full-module runtime test checks original/fixed code with the compiler enabled/disabled, and each variant passes 18 renders, 18 submissions and 54 callback invocations. Both compiled variants reuse the defaults on 9 of the 18 renders and have identical observed traces. This is less generated bookkeeping, not a demonstrated latency gain.

Details and assumptions: [runtime showcase notes](./notesautofix-showcase-results.md).

## Showcase 2: WorkspaceCreateTaxValuePage — focus setup stays together

[Before](https://github.com/Expensify/App/blob/df1e765feee11ea8983554979da24405a4b39411/src/pages/workspace/taxes/WorkspaceCreateTaxValuePage.tsx#L33-L56) · [After](https://github.com/Expensify/App/blob/9ad1d868fc789b93e1f5a622421a3745b457bb86/src/pages/workspace/taxes/WorkspaceCreateTaxValuePage.tsx#L33-L54)

The order changes from:

```text
form subscription and state
goBack handler
save handler
input ref
focus hook
render
```

to:

```text
form subscription and state
input ref
focus hook
goBack handler
save handler
render
```

That makes the input's setup easy to read before the event handlers. Hook order is identical. OXC stays at **33 slots and 14 guards**; this is a readability example, not a caching improvement. `useFocusEffect` is treated as a generic custom hook by the category classifier.

Browser smoke on this experiment's development server verified the focused input, typing `7.50`, saving the draft, the resulting `7.5%` value, reopening with `7.5` still present, and back navigation. No console errors remained after the tested flow. This tests that screen's draft/edit behavior, not the whole 124-file branch.

## Showcase 3: OwnershipPercentage — setup before validation

[Before](https://github.com/Expensify/App/blob/df1e765feee11ea8983554979da24405a4b39411/src/pages/ReimbursementAccount/NonUSD/BeneficialOwnerInfo/BeneficialOwnerDetailsFormSubSteps/OwnershipPercentage.tsx#L25-L52) · [After](https://github.com/Expensify/App/blob/9ad1d868fc789b93e1f5a622421a3745b457bb86/src/pages/ReimbursementAccount/NonUSD/BeneficialOwnerInfo/BeneficialOwnerDetailsFormSubSteps/OwnershipPercentage.tsx#L25-L52)

`useReimbursementAccountStepFormSubmit(...)` moves immediately before the `validate` function. A reader now encounters form setup, then validation, then rendering, rather than finding another hook below the validation body. The function body and hook arguments are unchanged.

OXC stays at **28 slots and 7 guards**, with no effective dependency change in the inspected output. A generated temporary's renumbering accounts for the comparison tool's dependency warning. This is another readability-only example; its browser flow was not exercised.

## Counterexamples worth keeping visible

The full branch also contains three movements that add compiler bookkeeping without improving the effective invalidation dependencies:

| File | Cache slots | Guards | Observation |
| --- | ---: | ---: | --- |
| `src/hooks/useDuplicateFeedDetection.ts` | 9 → 11 | 3 → 4 | Callback and returned object become separate caches |
| `src/pages/Search/SearchChangeApproverPage.tsx` | 76 → 78 | 20 → 21 | Helper and result become separate caches |
| `src/pages/workspace/taxes/WorkspaceCreateTaxPage.tsx` | 70 → 72 | 25 → 26 | Validator factory and result become separate caches |

Across the final 124 changed files, static totals are **8,611 → 8,615 slots** and **2,327 → 2,329 guards**. The net increase is four slots and two guards. These totals are static generated-code measurements, not runtime costs or a performance score.

The native comparison reports 25 files with heuristic warnings. Inspection found the four bookkeeping changes above; the other warnings concern generated temporary renumbering, outlined-function renaming, or anonymous callback position changes. No newly unguarded render call or actual dependency widening was identified in that inspection. This is not a general proof of compiler non-regression.

The intended next decision is whether these readable reorderings justify the modest compiler tradeoffs, or whether compiler-aware exclusions should accompany broader adoption.

## Verification and reproduction

- Rule tests: 127 passed, including runtime safety regressions and idempotence.
- Native Oxlint: read-only fixtures and autofix fixtures passed; mutation/directive barriers remain unfixed.
- App: `lint-changed`, full `typecheck`, `spell-changed`, and `react-compiler-compliance-check check-changed` passed. No changed-file OXC diagnostics remain in the final branch. The story is correctly classified as having no components by the compliance checker.
- All 124 source hook sequences are unchanged in the comparison tool; all files' committed hashes match the tested output.
- Required App coding-standard review and independent rule review returned no remaining findings.

From a clean experimental App worktree, point Oxlint at the rule from this package:

```sh
node /path/to/App/node_modules/oxlint/bin/oxlint \
  --config /path/to/eslint-config-expensify/benchmarks/component-body-order/oxlint.json \
  --disable-nested-config --threads 1 --fix .
```

From `eslint-config-expensify`, compare the changed files through native OXC:

```sh
node tooling/memoization/compare-ordering.mjs \
  --app /path/to/App-experiment \
  --base df1e765feee11ea8983554979da24405a4b39411 \
  --output "$SCRATCH_DIR/comparison.json" --artifacts "$SCRATCH_DIR/compiled"

node benchmarks/component-body-order/validate-autofix-showcases.mjs \
  --app /path/to/App-experiment --output "$SCRATCH_DIR/runtime.json"
```

The comparison CLI reports syntactic guards/dependencies, not compiler IR or a universal safety verdict. Its raw byte-equality metric reports differences for every changed file because emitted declarations and temporary names move. Artifacts allow human review of those differences. The runtime showcase uses controlled imported dependencies, not a full production form or bank-account flow.

## Isolated lint cost

The final autofix-capable rule was measured without `--fix` over **8,591 `src` files** on the result branch, using five samples after two warmups, one thread, and no other enabled rules:

| Mode | Median wall time |
| --- | ---: |
| Parse-only, zero rules | 683 ms |
| No-op JS plugin | 1,976 ms |
| Ordering rule, one rule | 2,500 ms |

The rule adds roughly 524 ms above the no-op JS bridge in that run. Raw timings: [autofix-lint-benchmark.json](./autofix-lint-benchmark.json). The whole-repo fix itself reported 6.8 seconds, but that is a single run over a different selection (11,408 files), not a repeatable speedup claim. The isolated invocation and repo-root run have different ignore/discovery contexts; their warning counts are not directly comparable.
