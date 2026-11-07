# Real App construction-order validation

## Result

**Two real App source pairs gain useful OXC memoization after a small manual movement; a third pair does not.** This supports diagnostic-first opportunity reporting. It does not establish automatic-fix safety, prevalence, or faster application execution.

| Actual App function | Manual candidate | OXC cache slots | Observed outcome |
| --- | --- | ---: | --- |
| `usePoliciesWithCardFeedErrors` | Move `cleanPolicies` declaration below `useCardFeedErrors` | 0 → 4 | Archive checks 27 → 18; admin checks 9 → 6 over nine updates |
| `RejectExpenseReportPage` | Move allocation and first conditional push of `options` below the submitter-details hook | 98 → 117 | Escaping options array constructed 8 → 5 times over eight parent updates |
| `useWorkspaceAgentsTable` | Move `policyRoles` declaration below the three custom hooks | 13 → 13 | Same guarded calls and relevant dependency predicate; no demonstrated benefit |

All six compiled source variants have empty diagnostics with `reportDiagnostics: true`. The two positive cases run **four ways**: original source, candidate source, OXC original, OXC candidate. The complete pinned modules are compiled/evaluated, with imported application services replaced by explicit controlled mocks. The page's original function body and JSX are retained; its returned element tree is inspected instead of mounting an App UI.

The four-way runs assert values against independent expectations, hook ordering, reference reuse/churn, and mock effect setup/cleanup. They include **68 parent-driven renders plus eight state-driven page renders = 76 total**. They pass under Node 24.22.1, `oxc-transform-react` 0.156.0, and React/test-renderer 19.2.3.

### Opportunity reporter cross-check

The harness also invokes `tooling/memoization/analyze.mjs`'s `analyzeSource` on each original/candidate pair. Dependencies are injected from the existing App package resolver, and both reporter engines receive the **Git-pinned configuration function**. It does not call `loadEngines` or load the working-tree compiler configuration. The reporter reference compiler is asserted to be `babel-plugin-react-compiler` **1.0.0**; Babel core **7.29.7** is recorded, and native OXC remains pinned to **0.156.0**.

| Named value / crossed hook | Original matching findings | Candidate matching findings |
| --- | ---: | ---: |
| `cleanPolicies` / `useCardFeedErrors` (hook at source line 18) | 1 | 0 |
| `options` / `usePersonalDetailByLogin` (hook at source lines 94–96) | 1 | 0 |
| `policyRoles` / any hook, negative control | 0 | 0 |

Both positive findings identify `FlattenScopesWithHooksOrUseHIR` changing the enclosing scope to `pruned-scope`, in a successfully compiled Babel function. The policies scope also names `policiesWithCardFeedErrors` and `policyWithCardFeedErrors`; the page scope names `options`. Both candidates have zero total findings in this run, as do both workspace-agent variants.

Assertions require the expected named value and hook in the original positive finding, elimination of that matching finding in the candidate, and no findings for the negative control. They also require the target function to compile, the observed pass to execute, empty diagnostics, and no unconfirmed scope changes. Thus an empty result caused by a skipped or failed analysis cannot pass as a successful elimination. JSON stores this evidence under each case's `reporter.before` and `reporter.after`, including locations, scope values, hooks, pass/result kind, and independent OXC status.

This cross-check connects reporter explanations to the independently measured OXC cache/runtime changes. Babel's explanatory IR is not treated as native OXC IR or as proof of source-movement safety.

## Reproduce

From `eslint-config-expensify`:

```sh
fnm exec --using 24 node benchmarks/component-body-order/validate-app-opportunities.mjs \
    --app ../App --output "$SCRATCH_DIR/app-opportunity-validation.json"
fnm exec --using 24 npx eslint benchmarks/component-body-order/validate-app-opportunities.mjs
```

Set `SCRATCH_DIR` to an existing writable scratch directory; omit `--output` to print JSON only. The runner needs installed App dependencies and local Git objects, but performs no network requests, checkout, package installation, or source writes. Every application module and the real shared compiler configuration come from `git show`, **not the App working tree**.

Source pin: `b14f3591fad1db21c32271e79e9fe66b433fc5dc`.

| File | Required Git blob |
| --- | --- |
| `src/hooks/usePoliciesWithCardFeedErrors.ts` | `0842888c67d9e5b4c20c6f628a5b39b3a557d062` |
| `src/pages/RejectExpenseReportPage.tsx` | `04c66ad7f3d33982017f407342778d3877cef40d` |
| `src/hooks/useWorkspaceAgentsTable.ts` | `1a3937d6c5f1041f2c91613be84b45dbf9c51a23` |
| `config/babel/oxcReactCompilerConfig.js` | `1f1978309f1b0dc417a7253e3214c648da05deec` |

The script checks each blob, requires unique exact movement markers, checks the source-token multiset, asserts source and compiled hook sequences, pins compiler/runtime versions, checks diagnostics, and asserts selected cache predicates, reporter findings, and runtime outcomes. The JSON includes all generated cache predicates, slot counts, guarded-call summaries, reporter evidence, per-update values/counters/identity, and hook/effect traces. These assertions intentionally require explicit rebaselining after a compiler upgrade.

Shared compiler options: React 19 target, `enableTreatRefLikeIdentifiersAsRefs: true`, `eslintSuppressionRules: []`, `panicThreshold: 'none'`, plus `reportDiagnostics: true`. Source controls use OXC TypeScript/JSX lowering with `reactCompiler: false`. Esbuild only lowers modules for controlled evaluation.

## Case 1: `usePoliciesWithCardFeedErrors`

Pinned source lines 13–18:

```ts
const cleanPolicies = Object.values(policies ?? {}).filter(...);
const {shouldShowRbrForWorkspaceAccountID} = useCardFeedErrors();
// Later: cleanPolicies.find(...), push matching policy into another array.
```

Candidate: move the existing comment and `cleanPolicies` declaration immediately after `useCardFeedErrors()`. No hook is moved relative to another hook. The entire filtering computation moves; its inputs already exist, and the intervening hook does not receive `cleanPolicies`. Its consumers remain below the declaration. There are no moved branches or early returns.

The original output has **no cache at all**. The candidate guards the filtering, error-policy lookup, admin check, and result object together:

```js
if ($[0] !== policies ||
    $[1] !== session?.email ||
    $[2] !== shouldShowRbrForWorkspaceAccountID) {
    // complete derived computation
}
```

This is a construction/consumer range spanning a hook under the compiler's conservative treatment of calls; the source does not explicitly mutate `cleanPolicies` after the hook. Its returned elements flow through `.find` and `.some` to an imported helper. The experiment establishes emitted behavior, not a claim that the imported helper actually mutates those inputs.

Nine-update trace: mount, repeat, unrelated parent input, policies-only change, repeat, errors-only change, session-only change, correlated changes, revisit original inputs.

| Mode | Archive checks | Admin checks | Reused `cleanPolicies` on stable/unrelated updates |
| --- | ---: | ---: | --- |
| Original source | 27 | 9 | No |
| Candidate source | 27 | 9 | No |
| Compiled original | 27 | 9 | No |
| Compiled candidate | 18 | 6 | Yes |

Fixtures include null/deleted policy entries, an archived policy, an error account with no matching policy, a false error flag, and admin email changes. Values are checked through deep equality against expected results. The monitored escaping reference is the filtered array; individual policy-object identity is not separately asserted.

**Precision limit:** errors-only and session-only changes still rebuild `cleanPolicies`, even though filtering logically depends only on `policies`. The recovered scope is coupled, not an optimal independent cache. This is visible both in the predicate and in runtime reference checks.

**Movement assumptions:** immutable plain snapshots; deterministic, total, side-effect-free archive/admin checks; the crossed hook does not mutate policies or change helper-visible ambient state. Mocks implement archive status and admin-email checks, rather than importing production `PolicyUtils` and its dependencies. They count calls as measurement instrumentation. Under this admitted model the changed ordering is unobservable before compilation; this is not a proof for arbitrary helper implementations, proxies, throwing getters, or suspension.

## Case 2: `RejectExpenseReportPage`

Pinned source lines 82–103 has a concrete fresh-array construction split by a hook:

```ts
const options = [];
if (hasPreviousApprover) {
    options.push(/* previous approver */);
}
const submitterName = usePersonalDetailByLogin(submitterEmail, ...);
options.push(/* submitter */);
```

Candidate: move **the allocation plus the entire first conditional push** below the existing `submitterName` hook call and before the final push. This reunites the whole options construction after the hook. The first push's values are already defined; the hook neither receives nor closes over `options`. The second push still receives the hook's returned submitter name. Hook order and render demand are retained.

The original compiles both `options.push` sites and `options.some` unguarded. The candidate guards all three. Its options cache depends on:

```text
hasPreviousApprover, previousApprover, selectedTargetAccountID,
submitterAccountID, submitterEmail, submitterName, translate
```

The later `options.some` has its own guard on `options` and `selectedTargetAccountID`. The existing previous-approver display-name computation remains separately guarded.

Eight parent updates: mount, repeat, unrelated delegate-access change, previous-approver-only change, repeat, submitter-name-only change, submitter-account-only change, revisit original inputs.

| Mode | Distinct consecutive options arrays | Stable/unrelated array reuse |
| --- | ---: | --- |
| Original source | 8 | No |
| Candidate source | 8 | No |
| Compiled original | 8 | No |
| Compiled candidate | 5 | Yes |

The runtime checks both option rows' text, email, key, account ID, and selected status. It then invokes the actual `onSelectRow` callback, verifies the real `useState` selection update, invokes `onBeforeSubmit`, and validates a nonempty comment through the real `useRef`-backed validation code. These actions add two renders per mode. The table counts only the eight parent updates.

Imported components are inert element types. Imported personal-detail hooks return controlled snapshots and register real React effects keyed by email; all four modes produce the same two setups and two unmount cleanups. The real page has no directly declared effect. This verifies mocked hook lifecycle, **not** production `SelectionList` effects or personal-detail subscription internals. Production descendants are not mounted, submission/network actions are not exercised, and the no-previous-approver branch is not covered by this trace.

**Movement assumptions:** translation, string conversion, snapshot reads, and display-name helpers are deterministic/total under the admitted plain-data fixture; the crossed hook cannot observe the unescaped options array or mutate those inputs. The move crosses translation work and hook execution, so unknown effects/throws/suspension would require additional analysis. Equality of displayed option values does not prove that changing the identity seen by real `SelectionList` is harmless. More stable props are the observed optimization, and consumer compatibility still needs review.

## Case 3: `useWorkspaceAgentsTable` negative control

Pinned source line 20 allocates `policyRoles = Object.values(CONST.POLICY.ROLE)` before three custom hooks; later loops consume it with `.find`. Moving that declaration immediately before `workspaceAgents` preserves the hook sequence but provides **no demonstrated cache benefit**.

Both outputs memoize the constant role list once and guard the workspace-agent construction on the same inputs:

```text
agents, manageableWorkspaceAgents, nonManageableWorkspaceAgentsIDs,
policyID, workspaceMembers
```

Both have 13 cache slots and identical aggregate guarded-call counts. Slot/temp renumbering and the order of constant-cache setup change. This control is compile-only: it is not claimed behaviorally equivalent. The actual body mutates `agent.role` from hook-returned data and calls `Log.warn`; those effects deserve attention rather than a blanket pure-construction interpretation. Lexical allocation-before-hook/use-after-hook alone is insufficient to diagnose an optimization.

The earlier `SearchSelectionFooter` experiment in `validate-footer-ordering.mjs` remains a separate negative result for its target totals reducers: ordering-only variants leave all four reducers unguarded. That experiment uses its own older source pin and is not rerun or upgraded by this harness.

## Boundaries and next use

- These are manually reviewed, exact source pairs; the harness checks reporter findings on those pairs and does not generate or apply edits to App.
- Source/candidate controls match the **observed** values, counters, identity churn, hook sequence, and mock effect lifecycle. The full temporal order of arbitrary helper side effects is not preserved or proved.
- Compiled array identities intentionally differ. External effects depending on those arrays may consequently differ; the mock effects depend on unchanged hook inputs, not escaping computed arrays.
- No general alias/effect proof, invalidation-dominance proof, exhaustive input exploration, Strict Mode, concurrent/aborted render, suspend/remount, native/browser execution, or wall-clock/memory benchmark is included.
- Cache-slot growth is bookkeeping, not a performance score. No latency reduction is claimed.
- OXC is authoritative for the reported caches and compiled runtime behavior. Babel IR supplies the separately labeled reporter explanation; no optional compiler mode is used.
- Narrow lint and the differential harness pass. Expected React test-renderer deprecation messages and repository lint dependency/version notices do not represent assertion failures.

These results give the opportunity reporter two concrete positive examples and one false-positive control, while keeping production transformations behind explicit semantic review.
