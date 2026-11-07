# Targeted memoization opportunity POC

This follows the investigation in [App issue 105956](https://github.com/Expensify/App/issues/105956). The first category-order rule can recommend harmful movements. The next step is an explanatory report tied to compiler analysis.

## What the report establishes

The reporter examines Babel's reference compiler immediately before and after the pass that removes memoization scopes containing hooks. It identifies the affected construction and the intervening hook, rather than recommending a generic category permutation.

App uses the native OXC compiler. A Babel finding is a **candidate explanation**, not proof that the native compiler makes the same decision. The report separately compiles each file through OXC with the shared App configuration and recoverable diagnostics enabled. Successful native compilation alone does not validate a caching improvement or prove a movement safe.

This first implementation is an offline development tool in `eslint-config-expensify`. It reads source files and reports opportunities; moving code still requires reviewing dependencies, possible mutations, and behavioral constraints.

## Running the reporter

From `eslint-config-expensify`, using Node 24.22.1 and an App checkout with installed dependencies:

```sh
node tooling/memoization/report.mjs --app ../App -- ../App/src/hooks/useExample.ts
node tooling/memoization/report.mjs --app ../App --json -- ../App/src/components/Example.tsx
```

Use actual source paths in place of the examples. The tool's compiler versions and individual file statuses are part of the result. Keep those with any finding so it can be reproduced after compiler upgrades.

## Reviewing a candidate

1. Read the full computation, including its later uses, captures, and mutations. A declaration is not necessarily the complete computation.
2. Determine whether a complete construction can move without changing hook order, input availability, control flow, or observable evaluation order.
3. Compile the original and candidate with App's native compiler. Check whether the relevant work is cached and whether unrelated inputs now invalidate it.
4. Exercise repeated renders, independently changing inputs, and relevant effects/reference identities. Equal rendered values are only part of the behavioral check.

An explanation can be useful even when no safe movement exists. For example, a construction used to form a hook argument and later modified using the hook's result cannot simply move wholesale across that hook.

## Measuring analysis cost

This analysis runs two compilers and is separate from the lightweight one-rule Oxlint benchmark. Measure it on explicit, pinned source snapshots rather than treating the earlier lint timing as its cost:

```sh
node benchmarks/component-body-order/benchmark-opportunities.mjs \
  --app ../App --target "$CORPUS_DIR/src/hooks" \
  --limit 25 --samples 5 --output "$SCRATCH_DIR/opportunity-benchmark.json"
```

The benchmark selects a deterministic spread of source files, includes process startup and report serialization, excludes one warmup, and records every measured sample. It verifies exact input-file coverage and deterministic report output, and records a content fingerprint for the selected corpus. It also checks that the working compiler configuration matches the Git blob at `--config-ref` (defaults to the source pin below), records its SHA-256 and compiler options, and verifies it before and after every run. This benchmark supports self-contained configurations only: configurations containing imports or requires are rejected until their dependencies can also be pinned. This is a sample measurement, not a full-repository timing or an estimate of per-keystroke editor latency.

## Results from this iteration

The reporter identifies both native-validated positive cases and stays quiet on the negative control:

| Pinned App function | Relevant finding before → after | Controlled native result |
| --- | --- | --- |
| `usePoliciesWithCardFeedErrors` | `cleanPolicies` crossing `useCardFeedErrors`: 1 → 0 | Archive checks 27 → 18; admin checks 9 → 6 |
| `RejectExpenseReportPage` | `options` crossing `usePersonalDetailByLogin`: 1 → 0 | Options-array constructions 8 → 5 |
| `useWorkspaceAgentsTable` | No `policyRoles` finding: 0 → 0 | No demonstrated cache improvement |

The positive cases compare original/candidate source and original/candidate native output using real React rendering, with controlled imported dependencies. Across 76 renders they check values, reference reuse, hook ordering, mocked effect lifecycle, and page state/ref interactions. The source movements are authored explicitly, not generated or applied by the reporter. See [the detailed evidence and assumptions](./app-opportunity-results.md).

Run the evidence and reporter checks:

```sh
node --test tooling/memoization/analyze.test.mjs
node benchmarks/component-body-order/validate-app-opportunities.mjs --app ../App
```

On the 25-file sample from App commit `b14f3591fad1db21c32271e79e9fe66b433fc5dc`, five fresh-process runs after one warmup had a **484 ms median**, with a **479–497 ms range**, on Node 24.22.1 / Apple M5 Max. Raw results and the exact selected files are in [opportunity-benchmark.json](./opportunity-benchmark.json). The sample includes ineligible/type-only files and one file with compiler diagnostics (`useNewTransactions`); the reporter returns exit code 1 for those diagnostics, and the benchmark records that status rather than silently excluding the file. These timings are not an all-clean analysis result.

This first diagnostic recognizes named construction scopes with work on both sides of a hook. It suppresses ordinary hook-return scopes, which would otherwise swamp useful findings. It does not yet diagnose the separate problem of independent constructions acquiring unnecessarily broad cache dependencies. That is the next analysis extension; the existing guard-count check alone cannot cover it.

The raw benchmark retains the measured checkout's absolute paths. `reportHash` verifies repeatability at those paths and is host-path-specific; use `corpusHash` and `configHash` to compare input contents across checkouts.
