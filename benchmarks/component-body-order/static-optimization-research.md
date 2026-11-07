# Can static analysis optimize React component structure?

## Conclusion

A deterministic, conservative optimizer can improve some component structures, but not by enforcing a fixed order of declarations and hooks. A sound tool must preserve dependencies and evaluation order, then check what **App's OXC React Compiler** actually emits. This investigation uses only the native OXC compiler for experiments and findings.

The first deliverable is a narrow, report-only diagnostic for a construction whose later work crosses a hook and whose emitted allocation remains outside a cache guard. It does **not** claim to know why OXC decided not to cache it, nor that moving it is safe.

Three distinct goals must not be conflated:

1. A movement preserves the relevant behavior.
2. A movement does not increase invalidations for the computations under study.
3. It reduces actual time or memory cost on the target workload.

Neither (1) nor (2) automatically proves (3). Cache checks, retained values, startup, and render frequencies matter.

## Native OXC evidence

The reproducible harness [`investigate-scheduling.mjs`](./investigate-scheduling.mjs) runs two configurations: OXC enabled with App's options, and the same OXC transform without React Compiler as a control. It enumerates all **30** orders of two independently allocated-and-mutated arrays and an unrelated effect while preserving allocation-before-mutation. It also exercises changed input identities, an early-return demand boundary, a hook argument that depends on a partially built value, intermediate primitive results, and an effect dependent on an array. The compiled and source controls are rendered with React test-renderer. Its [summary](./scheduling-summary.json) records versions and exact counts.

The six schedules that keep each allocation/mutation together independently cache the arrays; placing the effect first, between, or after the intact regions does not change that. Over nine renders, the separate construction order runs helpers **3 and 4 times**. Interleaving them makes both depend on either input (**5 and 5**); putting a hook inside the intertwined region makes both run every render (**9 and 9**). Both separate and interleaved versions still have guarded calls and eight cache slots. Guard counts alone therefore miss broadened invalidation conditions.

Keeping scopes separate can require more guard bookkeeping when both inputs change: the harness counts five generated cache-slot reads versus four for the coupled arrangement. That is an access count, not a time measurement or proof that coupling is faster. An all-miss workload may prefer different tradeoffs from one where inputs change independently.

Two other boundaries emerged:

- Moving a pure calculation before an early return increases executions from **2 to 3** on the tested hidden/shown sequence, despite the same guarded call. Moving possibly throwing or suspending work could additionally change behavior.
- With an effect depending on an array, independent caching triggers **3 setups** in the tested update sequence versus **5** with coupled caching. Rendered values are equal; effect traces are not. Whether that difference is acceptable needs an explicit semantic contract.

The opt-in category rule itself recommends moving one declaration before an effect in a case that takes `buildA` from **3 to 9 calls** on the same input sequence. Moving the *whole* construction instead keeps the work cached. The rule should therefore remain experimental and disabled by default.

The [real-App validation](./app-opportunity-results.md) uses pinned source blobs, OXC compilation and controlled runtime mocks: two reviewed movements improve caching, one control does not. They establish finite examples, not a production refactor guarantee.

## What OXC exposes and what it does not

App uses [`oxc-transform-react` 0.156.0](https://unpkg.com/oxc-transform-react@0.156.0/README.md). The published transform returns code, diagnostics, fatal status and optional source maps. Recoverable diagnostics require `reactCompiler.reportDiagnostics: true`. Absence of diagnostics is not proof that a particular function or expensive call is cached. The published Node API does **not** expose structured reactive-scope boundaries, dependency sets, or per-pass pruning reasons.

The [pinned native pipeline](https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler/entrypoint/pipeline.rs#L142-L308) already performs SSA conversion, type and alias/effect inference, mutable-range inference, scope construction/merging, hook-scope flattening, dependency inference, and pruning. There is no general instruction scheduler before it builds those construction ranges. Its [overlap handling](https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler_inference/merge_overlapping_reactive_scopes_hir.rs#L169-L246) explains why intertwined mutable ranges may merge. Its [hook-flattening pass](https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler_inference/flatten_scopes_with_hooks_or_use_hir.rs#L6-L98) cannot allow a memoized region to skip a required hook invocation. These are source-backed mechanisms; the public API cannot certify a particular pruning reason for an arbitrary file.

The reporter consequently compares **source syntax with OXC's emitted code**, and reports only a narrow pattern: a named construction before a hook, a later direct operation on that name, and a unique matching construction in OXC output that remains outside a cache guard. It can miss optimizations and may surface candidates where no safe movement exists. It never generates edits.

## What would make an optimizer credible?

**Semantic scheduling graph:** track definitions, direct and aliased reads/writes, captures/escapes, control dependence, possible exceptions, suspension, and hook sequence. An imported call or property read may invoke user code; `const` does not mean the referenced value is immutable. Start with a restricted class of fresh, unescaped local values and well-understood operations. Treat everything uncertain as a movement barrier.

**Memoization graph:** track emitted guards, actual cache-key predicates and intermediate equality checkpoints. Avoid increasing invalidation of a matched computation for unchanged inputs, but also count guard/retention overhead. Merely keeping a call guarded is insufficient.

Construction must sometimes remain split. In `allocate → hook(allocatedValue) → mutate(usingHookResult)`, contracting allocation and mutation into one scheduling node leaves `region → hook → region`: a cycle. Simple reordering cannot solve it while preserving dependencies.

For a *restricted model* of deterministic, total, observably pure operations over immutable snapshots, the target criterion is `Reuse_old ⇒ Reuse_new` for every matched demanded computation. If both caches use identical equality on the same canonical inputs, a sufficient condition can be `D_new ⊆ D_old` **provided the new key is still sufficient to compute the result** and cache history/lifetime is compatible. This bounds body recomputations, not wall time. An intermediate derived value may be equal even when its root input changes, so flattening keys to root-variable names misses valid reuse opportunities.

Arbitrary JavaScript cannot be fully analyzed for exact dependencies: unknown functions, getters, aliases, observable effects, and unbounded computation defeat a universal, sound-and-complete optimizer. This does not rule out a deterministic, conservative optimizer over a defined subset or a finite search among proven-legal schedules.

## Next steps

1. Collect **OXC-only** candidate diagnostics and manually validate several representative components, retaining negative controls and rejected cases.
2. Extend analysis to detect broadened native cache-key predicates, not just unguarded constructions. Compare callsites by source location and record key dependencies rather than counting guards or slots.
3. Define and verify a small set of legal whole-construction movements. Compile each candidate with the same pinned OXC configuration, test independent input changes and effect/identity behavior, and skip anything whose semantic safety cannot be established.
4. Profile production interactions before asserting latency improvements. Benchmark the more expensive offline analyzer separately from Oxlint; do not add compiler analysis to the cheap rule's lint run by default.

The evidence supports a constrained opportunity reporter and eventually a compiler-aware scheduler—not a broad autofix or a universal category ordering.
