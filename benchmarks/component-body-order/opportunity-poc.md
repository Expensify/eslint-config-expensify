# OXC-only memoization opportunity POC

The offline reporter in `tooling/memoization` uses **only App's installed OXC React Compiler**. It finds a deliberately narrow source pattern: named construction before a hook, later direct work on the constructed value, and an unguarded matching construction in native compiler output. It does not claim to identify OXC's internal reason for leaving the value unguarded. There is no autofix or assertion that a movement is safe.

```sh
node tooling/memoization/report.mjs --app ../App -- ../App/src/hooks/useExample.ts
node tooling/memoization/report.mjs --app ../App --json -- ../App/src/pages/Example.tsx
```

This uses the App checkout's installed `oxc-transform-react` and shared configuration; it never writes App source. The report records compiler version and per-file errors. `reportDiagnostics: true` includes recoverable diagnostics. Findings require a uniquely matched named function, an imported direct hook call, and a cache-runtime import added by OXC relative to the compiler-off transform. Files with no emitted compiler cache, unsupported patterns or ambiguous emitted names are omitted; absence of a finding does not imply optimal caching.

## Actual App validation

Pinned source from App commit `b14f3591fad1db21c32271e79e9fe66b433fc5dc` was manually moved in memory. Native compilation and controlled React rendering compared original/candidate source and original/candidate compiled output. See [the full results and mock assumptions](./app-opportunity-results.md).

| App function | Native finding before → after | Controlled result |
| --- | --- | --- |
| `usePoliciesWithCardFeedErrors` | 0 → 0; native baseline does not expose a cache, so no compilation finding is claimed | Archive checks 27 → 18; admin checks 9 → 6 |
| `RejectExpenseReportPage` | `options` crossing `usePersonalDetailByLogin`: 1 → 0 | Options-array constructions 8 → 5 |
| `useWorkspaceAgentsTable` | No `policyRoles` finding: 0 → 0 | No demonstrated improvement |

The two manually moved cases checked 76 renders in total, including values, hook order, reference stability, mocked effects, and page state/ref interactions. The reporter covers the page but intentionally abstains on the policies case. This is not application-level QA or a latency benchmark. Read the full computation, its later uses, potential side effects, and required hook arguments before moving anything.

```sh
node --test tooling/memoization/analyze.test.mjs
node benchmarks/component-body-order/validate-app-opportunities.mjs --app ../App
```

## Separate analysis benchmark

The reporter calls the installed native compiler; it is not part of the lightweight Oxlint rule. The reproducible benchmark selects files from a pinned source snapshot and verifies that the App compiler configuration matches the pinned Git blob:

```sh
node benchmarks/component-body-order/benchmark-opportunities.mjs \
  --app ../App --target "$CORPUS_DIR/src/hooks" \
  --limit 25 --samples 5 --output "$SCRATCH_DIR/opportunity-benchmark.json"
```

It records one warmup, five fresh-process timings, exact sampled files, source/configuration hashes, and compiler statuses. The output's `reportHash` includes checkout-specific paths; source and configuration hashes are portable. The sample includes a file with existing compiler diagnostics; the reporter returns exit code 1, and the benchmark records it rather than silently excluding that file.

In the OXC-only run on 25 pinned App hook files, the median was **258 ms** across five runs (range **255–276 ms**) on Apple M5 Max / Node 24.22.1. This includes process startup, source parsing, native compilation, reporting and one existing diagnostic file. Raw samples: [opportunity-benchmark.json](./opportunity-benchmark.json). It is not a complete App scan or editor-interaction measurement.

**Broadened cache dependencies remain unsolved.** A guarded call can still start rerunning for unrelated input changes. The next analysis extension needs to compare the native compiler's invalidation predicates for corresponding callsites. The [research summary](./static-optimization-research.md) explains why a fixed category order is insufficient.
