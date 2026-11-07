# Can static analysis optimize React component structure?

## Conclusion

**Yes: a deterministic, conservative optimizer can safely improve a useful subset of component structures. There is a concrete missing optimization opportunity around scheduling construction regions before React Compiler infers memoization scopes.**

The achievable objective is substantially more precise than sorting categories:

> Preserve the supported program semantics, avoid unnecessary coupling between independent computations, preserve useful intermediate equality checks and demand boundaries, and choose among legal schedules using an explicit cost model.

Three different guarantees must be distinguished:

1. **Behavior preservation:** the transformation is valid under stated semantic assumptions.
2. **Computation-count non-regression:** a matched computation does not execute in additional situations, under a specified cache/demand model.
3. **Runtime improvement:** total time, memory, startup, and interaction costs improve for the relevant workload.

None automatically proves the next. A general, universally fastest arrangement for arbitrary JavaScript is neither a well-defined workload-independent objective nor something a complete static analysis can always discover. That does **not** rule out useful, sound transformations, a deterministic normal form for a supported subset, or optimal search within a finite candidate family.

**Recommendation:** develop a compiler-guided memoization-opportunity analyzer and then a constrained scheduler. Use readability categories as a tie-breaker among legal choices. The current category-order lint POC does not guarantee memoization non-regression; semantic soundness is also unproved.

## What changed: expanded evidence

### Reproducible method

[`investigate-scheduling.mjs`](./investigate-scheduling.mjs) exercises **190 fixture/engine combinations and 1,720 renders**. [`scheduling-summary.json`](./scheduling-summary.json) records the observed results. Run from this repository:

```sh
node benchmarks/component-body-order/investigate-scheduling.mjs \
  --app ../App --output "$SCRATCH_DIR/scheduling-full.json" \
  --summary "$SCRATCH_DIR/scheduling-summary.json"
```

The script uses installed App dependencies, compiles in memory, mounts through real React test-renderer, checks rendered values and independent allocation identity, counts helper calls, records reference stability, and checks hook order and effect setup/cleanup. The main update sequence covers unchanged inputs, changing only A, changing only B, changing both, and revisiting a previous B identity. Additional fixtures cover demand, state initialization, effect dependencies, and intermediate primitive results.

Versions:

| Configuration | Version / purpose |
| --- | --- |
| Uncompiled control | OXC TS/module processing with `reactCompiler: false` |
| App compiler | `oxc-transform-react` 0.156.0, shared App compiler options |
| OXC Forest | Same engine with experimental `enableForest: true` |
| Babel reference | Installed `babel-plugin-react-compiler` 1.0.0, not a claim about latest upstream |
| Historical scheduler | Same Babel 1.0.0 with `enableInstructionReordering: true` |
| Runtime | Node 24.22.1; React and react-test-renderer 19.2.3 |

App options: React 19 target, `enableTreatRefLikeIdentifiersAsRefs: true`, `eslintSuppressionRules: []`, `panicThreshold: 'none'`. OXC experiments add `reportDiagnostics: true` to expose recoverable diagnostics; this is observability, not a scheduling change. They require empty diagnostics and verify whether compilation actually occurred. Babel errors and generated compiler-runtime imports are also checked.

The actual OXC implementation is pinned by [npm release provenance][oxc-provenance] to [`75efdca4747c4ad9b252542743098d4894f8005b`][oxc-package], not inferred from the separately installed Babel version. Babel 1.0.0's [release metadata][babel-metadata] pins it to [`5c15c1cd3442f28044217703b5625f98c40042ee`][mutability-model].

These are semantic/counter experiments, **not wall-clock benchmarks**. React test-renderer runs without Strict Mode. A transparent proxy around the compiler cache counts generated numeric-slot reads/writes; it does not measure their time or React runtime internals. Helper counters are instrumentation, not intended application side effects. The helpers themselves model pure operations on frozen, plain input arrays. Source-code comparison, output assertions, and these finite traces do not constitute a proof for arbitrary JavaScript.

### 1. Exhaustive small scheduling family: six arrangements retain independent caching

Use two independent constructions and one unrelated effect:

```js
const a = buildA(inputA); // A: returns a fresh slice
a.push(1);               // a: finishes that array
const b = buildB(inputB); // B: returns a different fresh slice
b.push(2);               // b: finishes that array
useEffect(effect, []);   // E: setup and cleanup observed
return {a, b};
```

There are **30 permutations** satisfying `A < a` and `B < b`. All produce the expected values and the same unrelated-effect lifecycle in the tested family. All four compiled configurations agree on the useful caching arrangements:

```text
AaBbE  AaEBb  BbAaE  BbEAa  EAaBb  EBbAa
```

That is exactly the six ways to arrange three intact units: construction A, construction B, and the effect. Effects can be first, middle, or last. The category rank of effects is not the decisive property.

Across nine renders:

| Schedule | `buildA` calls | `buildB` calls | What changed |
| --- | ---: | ---: | --- |
| `AaBbE`: separate complete regions | 3 | 4 | Each calculation responds only to its own input |
| `ABabE`: crossing regions | 5 | 5 | Both calculations respond to either input |
| `AEBab`: hook inside crossing regions | 9 | 9 | Both run on every render |
| Uncompiled controls | 9 | 9 | Every arrangement executes both helpers on every render |

The other schedules exhibit mixed outcomes, such as one independently cached region and one always-running region. A hook does not invalidate every cache in the function; nesting and each region's construction interval matter.

The harness also invokes the actual POC lint rule: it recommends moving derived values before effects in `EAaBb`, accepts `AEaBb`, and the compiled `buildA` count regresses **3 → 9**. This is a checked counterexample to that recommendation, not only an arbitrary harmful permutation.

**Key finding:** the construction-region hypothesis has positive evidence beyond a single hand-selected pair. It is still a small family with known independence, not an exhaustive characterization of component programs.

### 2. Guard counts and cache-slot counts miss regressions

`AaBbE` and `ABabE` both emit one guarded call to each helper, and both use eight cache slots. Nevertheless, the latter recomputes `buildA` on B-only changes and `buildB` on A-only changes.

The effective guards differ:

```js
// Separate
if (inputA changed) { a = buildA(inputA); a.push(1); }
if (inputB changed) { b = buildB(inputB); b.push(2); }

// Coupled
if (inputA changed || inputB changed) {
    a = buildA(inputA);
    b = buildB(inputB);
    a.push(1);
    b.push(2);
}
```

The call-guard-count approach motivating [App PR 106100](https://github.com/Expensify/App/pull/106100) remains useful for a disappearing guard. It is insufficient to certify non-regression of invalidation behavior.

### 3. More precise caching can involve more bookkeeping

On the tested update where **both inputs change**, `AaBbE` performs five generated cache-slot reads; `ABabE` performs four. Both execute the two helpers once. This difference follows the two independent guards versus a combined short-circuiting guard.

On single-input changes, separate caching avoids an entire helper call. On correlated all-miss updates, that saving disappears and bookkeeping differs. This is evidence of a cost tradeoff, **not proof that the merged version is faster**: no latency was measured, and JIT/runtime costs are not determined by a read count.

Consequently, “maximum number of memoized regions,” “fewest slots,” and “fewest helper calls” are different objectives. The compiler deliberately merges some scopes that invalidate together to reduce overhead.

### 4. Demand matters even when the emitted calculation stays memoized

Compare:

```js
if (!visible) {
    return {value: null};
}
const value = expensive(inputA);
return {value};
```

with moving the calculation before the early return. The fixture includes an unchanged hook before either version, and `expensive` is pure and total for the admitted inputs.

Across six hidden/shown updates, the compiled versions execute `expensive` **2 versus 3 times**, while returning identical values. Both retain one guarded `expensive` call and the same cache-slot count. The uncompiled controls execute it 3 versus 6 times.

A sorter that groups all calculations before render guards can add work even without broadening a cache key. If the calculation could throw or suspend, the same movement could additionally change behavior. The latter is a semantic constraint, not something this value-only fixture proves safe generally.

### 5. Some construction regions cannot move intact across a hook

```js
const a = buildA(inputA);
const [count] = useState(a.length);
a.push(count);
return {a};
```

The allocation must precede the hook's argument evaluation. The mutation needs the hook's result. A statement permutation preserving these dependencies cannot put the complete construction wholly before or after the hook.

The experiment runs ten renders, including an input-length change, and verifies that the initial state is preserved. `buildA` runs ten times in every tested compiler configuration. A trial rewrite using an immutable prefix and `const a = [...prepared, count]` also runs it ten times; merely replacing explicit mutation with a copy is not a demonstrated fix.

This does not prove that no broader rewrite could optimize the example. A tool with stronger knowledge of `buildA`, a different cache partition, helper extraction, or additional copying might do better. It proves that **statement sorting alone is constrained**, and that a proposed complete-region scheduler must sometimes abstain.

There is an important graph consequence: in `allocate → hook → mutate`, contracting just `{allocate, mutate}` into one construction node `R` while leaving the hook outside creates `R → hook → R`. The original program graph is acyclic; the proposed contraction is invalid. Region construction must check this rather than treating every allocation-to-last-mutation set as an automatically schedulable unit.

### 6. Intermediate equality checks can matter more than source order

```js
const intermediate = cheap(inputA);
const value = expensive(intermediate);
```

In the fixture, `cheap` returns the boolean `inputA.length > 0`. Many distinct input arrays therefore produce the same intermediate result. Exposing that primitive result with `!!cheap(inputA)` preserves this fixture's behavior and changes the cache partition:

| Twelve-render sequence | `cheap` calls | `expensive` calls |
| --- | ---: | ---: |
| Opaque imported result | 5 | 5 |
| Explicit primitive result | 5 | 3 |

All four compiled configurations agree. The ordering is identical. Both expensive calls are guarded, and both have the same transitive root input, `inputA`. The more precise version can stop invalidation when the intermediate boolean stays equal.

This is **not** a recommendation to insert `!!` indiscriminately: it is equivalent here because the helper's specified result is already boolean. It demonstrates the importance of type/effect information and equality checkpoints. A checker that flattens both dependency graphs to `{inputA}` would miss the distinction.

An analogous conceptual example is a cache keyed on `count % 2` versus one keyed on `count`: on `0 → 2`, only the latter invalidates despite identical transitive input support. The upstream [expensive-consumer report][consumer-issue] documents the same general boundary problem.

### 7. Preserved output is weaker than preserved behavior

Repeat the separate/interleaved construction experiment with an effect depending on `[a]` instead of `[]`.

| Across nine renders | Effect setups | Effect cleanups, including unmount |
| --- | ---: | ---: |
| Separate compiled regions | 3 | 3 |
| Interleaved compiled regions | 5 | 5 |
| Either uncompiled arrangement | 9 | 9 |

Rendered values remain identical. The extra setups in the interleaved version include repeats with exactly the same array contents. Reference stability changed the effect dependency comparison.

This is often the practical benefit of memoization, and React's [effect-dependency guidance][effect-memoization] documents it as such. But it means an optimizer cannot claim exact external-call-trace equivalence based solely on equal output values. A strict identity/effect-trace contract and a contract permitting memoization-induced reuse are different specifications. The optimizer must say which it preserves. Changed setup counts are not automatically safe for every application effect; identity-sensitive escapes and synchronization need an explicit compatibility argument.

## What matters for this repository

### The compiler already performs much of the required analysis

The [pinned OXC pipeline][oxc-pipeline] contains SSA, constant propagation, type inference, nested-function analysis, mutation/alias effects and ranges, reactive scope inference, scope alignment/merging, hook-scope flattening, property-path dependency inference, escape-based pruning, and code generation.

The missing piece is **general dependency/effect-driven instruction scheduling before construction ranges become memoization intervals**. It is not missing ordinary memoization or all forms of code motion: outlining, IIFE inlining, expression reconstruction, and dependency-load hoisting already change emitted structure.

Mechanism:

1. Mutation and alias analysis identifies values that may construct/mutate together. The [pinned unknown-call implementation][oxc-unknown-call] allows mutation of applicable arguments, return aliases, and captures between arguments; the [upstream model][mutability-model] explains these concepts. A lexical reference graph cannot replace this analysis.
2. [Scope inference][oxc-scopes] assigns ranges based on the current instruction order.
3. [Overlap handling][oxc-overlap] merges crossing scopes and handles mutations reaching enclosing scopes. Properly nested scopes can survive; not every overlapping interval is simply flattened into one unit.
4. [Hook-scope flattening][oxc-hooks] removes active enclosing memo scopes containing a hook or `use` call. Memoizing such a scope would skip a required call on a cache hit. `use` permits some conditional invocation, but cannot be skipped merely because the surrounding result is cached.
5. [Dependency inference][oxc-dependencies] derives guarded input/property paths. Later passes prune caches that would always miss or provide no useful escaping result.
6. [Late merging][oxc-merge] combines eligible scopes that invalidate together to reduce overhead. Avoiding accidental overlap and enabling deliberate equal-invalidation merging are different optimization goals.

Thus a safe scheduler could improve the input to existing analyses rather than replace them. But compiler conservatism may stem from missing helper-effect information; rearrangement is not the only remedy.

### Upstream explicitly identifies this opportunity

In [React's source-order issue][order-issue], Joe Savona explains that memo blocks include construction instructions and intervening instructions, then says:

> “the robust way to handle this is instruction reordering in the compiler”

He also emphasizes its subtlety and rejects an attempted fix that weakened mutation assumptions. [Splitting memoization blocks][split-comment] is another possible, nontrivial approach.

There is concrete prior art:

- [Babel 1.0.0's experimental instruction reorderer][old-scheduler] builds instruction/lvalue dependencies, chains non-reorderable operations, serializes relevant named-variable accesses, and uses ordering weights.
- Its whitelist is limited; ordinary calls, general array/object construction, and stores are not generally movable. It therefore does not solve the tested construction family merely by enabling the flag.
- [Upstream removed that experiment in February 2026][scheduler-removal], explicitly saying it would try a different approach. It is historical design material, not a supported modern flag omitted accidentally from App's OXC setup.
- OXC's Forest flag changes selected scope/pruning behavior, not the absence of a general scheduler. Its identical results here are not evidence that it has no other effects; notably its JSX policy differs.

React's [design goals][design-goals] explicitly make perfectly optimal re-rendering with zero unnecessary recomputation a **non-goal**, because tracking overhead, conditional dependencies, and code-size/startup costs matter. That is consistent with the measured bookkeeping tradeoff, not evidence that useful improvements are impossible.

### Feasible introspection versus actual execution engine

The published [OXC Node API][oxc-api] exposes generated code, maps, diagnostics, JSX preservation, and lint mode. It does **not** expose a structured reactive-scope graph, per-pass logger callback, or callback-valued type provider. Lint mode suppresses compiler rewriting; use client compilation when examining emitted caches.

Babel 1.0.0 exposes `logger.debugLogIRs`, HIR/ReactiveFunction values, IR printers, and `CompileSuccess` metrics. A direct local probe successfully observed a construction scope change to `<pruned>` in `FlattenScopesWithHooksOrUseHIR`, while compilation still reported success with one memo block and one pruned block. This provides a practical explanatory prototype. Snapshot the needed data inside callbacks because later passes mutate IR objects; avoid serializing full cyclic compiler state.

The upstream experimental [React MCP compiler tool][react-mcp] demonstrates agent-facing IR inspection. Babel's [logger contract][logger] warns that events can change between versions. A separately pinned Babel analyzer is useful for explanation, **not authoritative proof of OXC output**. The four configurations agree on our fixtures, not necessarily on all App code.

A durable native solution should expose a small structured OXC scope summary with source locations, dependencies, outputs, and merge/pruning reasons. A native scheduling pass could then reuse the engine's actual effects model. A source tool in this package could consume that analysis while keeping the lint rule itself inexpensive.

## A precise, useful guarantee

### Determinism is the easy part

Fix the source, compiler version/configuration, effect summaries, target, cost model, candidate-generation order, and tie-breaks. A stable topological scheduler or bounded search is deterministic. For eventual stabilization, use a canonical result, a strictly improving rank over a finite candidate family, or another well-founded improvement relation. Eventual stabilization does not imply one-pass idempotence, and determinism alone implies neither.

**Soundness** means every accepted transformation preserves the specified behavior. It may reject uncertain cases. **Completeness** means finding every opportunity within a specified class. **Optimality** means minimizing a defined cost over defined candidates and workloads. These properties are not interchangeable.

### Restricted invalidation-dominance criterion

Restrict this argument to deterministic, total computation regions with **no observable effects**. Confined construction/mutation is allowed only under the chosen identity contract. Equal returned values are insufficient if an invocation also sends a notification or performs other observable work: caching would suppress that work.

For a matched computation `F`, consider two admitted immutable snapshots `s` and `t`, and cache key `K` with the actual comparison relation used by the engine.

First prove key sufficiency:

```text
Equal(K(s), K(t)) implies F(s) is observationally equivalent to F(t)
```

Then require the new cache to reuse in at least all situations where the old cache reuses:

```text
Reuse_old(s, t) implies Reuse_new(s, t)
```

Equivalently, the new invalidation predicate must imply the old one for those snapshot pairs. To derive an execution-count guarantee from that relation, we additionally need a cache-state argument. For the simple theorem below, assume flat, single-entry caches, the same validity/reset policy and demand/consultation sequence, keys updated on cache misses, and comparisons that are **equivalence relations on the admitted atoms**. For projections onto the same canonical immutable atoms, a decidable sufficient condition is:

```text
D_new is a subset of D_old

invalidate(D, changedAtoms) = (D intersects changedAtoms)
```

Under those assumptions, the retained snapshots agree under the new key's equivalence after each consultation, even if the old cache refreshes more often. An old cache hit therefore cannot coincide with a new cache miss. With a sound operation correspondence and no unaccounted duplicated work, each matched body operation executes no more often. Any nonnegative weighted sum of those body executions is non-increasing.

That is a meaningful, workload-independent guarantee **for this restricted model**. It is not a guarantee of lower total runtime: additional guards, key materialization, allocations, retention, and code size need separate obligations.

Important limitations of the test:

- Key sufficiency must be proved; deleting inputs to make a smaller set is not valid optimization.
- Named root sets are insufficient. Intermediate equality checkpoints, nested caches, control predicates, and cache histories matter, as the primitive-result experiment demonstrates.
- An object reference and its property are different atoms with different change behavior; fewer dependency entries need not be more precise.
- Preserve actual equality semantics. React hook dependency comparison uses `Object.is`; emitted compiler checks must be analyzed as emitted rather than assumed identical. `NaN` and signed zero expose differences between equality relations.
- Do not silently extend the theorem to arbitrary custom comparators. For example, approximate numeric equality can be nontransitive, and caches refreshed at different times can then reverse the execution-count ordering. The simple theorem must restrict admitted values/comparisons appropriately, or use a stronger cache-state simulation; non-reflexive cases such as `NaN` under `===` need explicit treatment.
- Same demand/consultation and cache lifetime are substantive assumptions. Moving computation across branches, suspension, remounts, or cache reset points requires a stronger cache-state simulation argument.
- A DAG representation alone is not a restricted semantic model: one node can call arbitrary JavaScript. Operations need supported semantics or trusted effect/value summaries.

### Why complete arbitrary-JavaScript optimization is too strong

Even exact dependency discovery is undecidable in the usual unbounded computation model. Consider a pure function whose every invocation terminates:

```js
function value(n, x) {
    return machineHaltsWithinNSteps(M, n) ? x : 0;
}
```

Determining whether `x` is irrelevant for **all** finite nonnegative `n` determines whether arbitrary machine `M` ever halts. Thus purity and terminating individual calls do not make exact semantic dependency minimization generally decidable. This is a specific application of classical computability limits, not a claim that every useful optimization problem is undecidable.

A finite-state model can in principle be exhaustively analyzed, and a finite candidate set with sound move preconditions can be completely searched. Those weaker, practical goals remain available. We should not use the general impossibility result as a reason to abandon a conservative optimizer.

## Implementation checklist: a credible next POC

### 1. Define the accepted semantic subset

Start with straight-line regions, immutable input snapshots, known deterministic and total operations with no observable effects, and fresh unescaped local allocations with understood mutation under the chosen identity contract. React's [purity contract][purity] explicitly allows local mutation; a useful tool must model it rather than reject all mutation. Treat unknown calls/getters/iterators/coercions, abrupt completion, unsupported closures, and unmodeled aliases conservatively.

JavaScript property access can call a getter or Proxy trap; spread can invoke iterators; coercion can call user code. `const`, TypeScript `readonly`, and shallow freezing do not prove the relevant operations commute. Two otherwise pure calls that can throw may not be safely swapped because the first observed exception can change. Preserve React's supported argument/return immutability boundaries.

### 2. Maintain two distinct graphs

**Semantic scheduling graph:** definitions/uses, read/write and write/write dependencies through aliases, captures/escapes, control conditions, dominance, exceptions/suspension, and hook sequencing. Keep existing ordinary hook relative order as a conservative policy; this is not a claim that every static source-version hook permutation is inherently illegal.

**Memoization graph:** retained/pruned scopes, their invalidation predicates, intermediate equality checkpoints, outputs, containment, and lifetime/reset behavior. This explains performance but is not itself a proof that changing source order is legal.

Use source-location/callsite identities to match operations. Aggregating by callee name loses distinctions when the same helper occurs in several scopes.

### 3. Construct schedulable regions

Follow aliases and mutations through finalization, not just declarations. Distinguish actual mutation, possible mutation, intermediate observations, and reference escape. Keep independent construction chains from crossing where allowed.

Validate proposed contraction against the graph. The allocation/hook/mutation example demonstrates why whole-region contraction can introduce a cycle. Either leave that region unchanged or introduce a separately justified transformation that changes its data flow. Do not silently suppress the edge.

Avoid moving work into previously undemanded paths. Do not move callback/effect work into render just to place it in a preferred category. Preserve closure snapshots; replacing captured values with reads of the latest ref is a different behavior.

### 4. Generate deterministic candidates, not a universal category permutation

For a small block, enumerate a bounded set of legal topological schedules or use a deterministic beam search. Useful objectives include:

- Remove hook crossings in otherwise movable construction regions.
- Avoid accidental crossing of independent mutable ranges.
- Preserve useful intermediate equality checkpoints.
- Make truly equal-invalidation scopes adjacent so the compiler can reduce overhead.
- Minimize live/retained values and source churn where the main objectives tie.
- Apply inputs/subscriptions/state/derived/handlers/effects/render preferences among remaining equivalent legal choices.

Greedy “finish the current construction first” is an understandable heuristic, not a proven global optimum. A local mutation may depend on values produced elsewhere; scheduling one region can lengthen another. Exhaustive enumeration of a finite family is possible but can grow factorially. Bounded search gives a reproducible best-found answer, not a global-optimality certificate.

### 5. Recompile and validate actual cache behavior

Use the pinned App engine, not merely a Babel prediction. Check compilation/bailouts, operation mapping, guard predicates, intermediate boundaries, dependencies, and relevant identity. Neither compiler success, more cache slots, nor guard counts alone are sufficient.

For the simplest supported subset, implement the invalidation-dominance check above. For richer cases, classify evidence honestly: inferred dependency upper bounds, finite differential execution, profiling, or an actual proof are different levels of assurance.

Compiler-guided output comparison detects cost regressions; it does not prove the source movement legal. A compiler successfully compiling two programs does not establish their equivalence.

### 6. Differential testing and profiling

Compare all four relevant programs: original source, transformed source, compiled original, and compiled transformed. Test:

- Stable inputs, each independently changing input, correlated changes, value-preserving derived changes, and revisiting old inputs.
- Aliases, captures, mutations, reassignments, and mixed cache hits/misses.
- Conditional demand and potential exceptions/suspension.
- Effect setup/cleanup, callback snapshots, ref behavior, state/context updates, mount/unmount, and the chosen identity contract.
- Manual memoization guarantees where existing code relies on them.

Upstream's [Sprout differential harness][sprout] is relevant precedent. Finite tests should accompany sound move preconditions, not replace them. Profile representative production interactions before claiming time savings; measure cache overhead, retained memory/GC, startup/code size, and abandoned render work where relevant.

### 7. Separate diagnostic cost from optimization search

The existing isolated lint benchmark is approximately 2.3 seconds for 8,591 files; that measures the simple POC, not this proposed optimizer. An alias/effect analysis and multiple compiler invocations are a different workload. Do not transfer the current performance claim to a future graph-aware rule.

A practical progression is:

1. **Opportunity report:** explain which value's construction spans which hook, or which overlap adds which invalidation dependency.
2. **Constrained offline codemod:** produce reviewed candidates with before/after compiler evidence and differential tests.
3. **Native compiler improvement:** reuse existing IR/effect analysis before mutable-range inference, or investigate split memo blocks. This can improve runtime code without forcing developers to hand-maintain compiler-specific source ordering.
4. **Lightweight lint integration:** consume cached/pinned analysis or enforce only proven structural patterns; benchmark it independently.

The rule and analysis tooling can remain in `eslint-config-expensify`. A robust native scheduling or scope-summary API would be an upstream compiler contribution, a separate implementation choice from the current package-only POC.

## Related work and what to borrow

| Work | Relevant idea | Important boundary |
| --- | --- | --- |
| [Program Dependence Graph][pdg] and [Global Code Motion][gcm] | Separate legal placement constraints from schedule heuristics | React adds hook, identity, freeze, and memoization constraints |
| [Lazy Code Motion][lcm] | Avoid redundant computation without unnecessarily extending lifetimes | Classical lifetime/computational optimality is for a specified problem, not all React workloads |
| [Prepack's Effects model][prepack-effects] | Track changed bindings/properties, allocations, environment interactions, and abrupt completion | Archived whole-program partial evaluation, not a drop-in modern scheduler |
| [Self-adjusting computation][self-adjusting] | Formal correctness of reuse/change propagation is achievable under a defined semantics | Stronger runtime/instrumentation model than source sorting |
| [Adapton][adapton] | Demand-driven incremental work and reuse across changes | Runtime redesign; does not follow from rearranging statements |
| [Cache-transfer-style incrementalization][cts] | Explicit caches and provably consistent update computations | Functional/change-calculus assumptions need substantial adaptation to mutable JS |
| [Equality saturation][egg] | Search several equivalent representations without prematurely fixing rewrite order | Requires sound effect-aware rewrites and a suitable nonlocal cost model |

Source reordering also cannot generally turn an invalidated `items.map(expensive)` into an incremental per-item update. The current compiler [flattens scopes inside loops][oxc-loops]; preserving per-item caches needs identity/reconciliation or a different abstraction. That is a larger optimization problem than component-body scheduling.

## Risks and unknowns

- **Adoption is not established.** The first lint POC can recommend a caching regression by splitting a construction across an effect. Its syntax tests and read-only reviews do not certify semantic or memoization optimality.
- **Prevalence is unknown.** The experiments establish mechanisms and counterexamples, not how many App components would benefit from safe scheduling. The earlier real-footer ordering-only experiment still leaves all four totals reducers unguarded.
- **The strongest guarantee is specification-dependent.** Exact JavaScript identity/external-effect traces differ from a React contract that permits memoization-induced reference reuse. An optimizer must not blur them.
- **Cost tradeoffs remain.** A no-added-body-work guarantee is useful but weaker than universal runtime improvement. Update distributions, calculation costs, retention, startup, and latency priorities matter.
- **The compiler is an analysis dependency.** OXC and Babel agreeing here does not make their IR or behavior interchangeable. Native bindings expose no stable scope-graph API; upgrades require rerunning the evidence.
- **The test model is limited.** Fixtures use custom hooks invoked by a real component, not a complete App screen. No Strict Mode, suspended/concurrent/aborted render trace, native/browser timing, or comprehensive context/ref/event interaction test was run. The shared compiler pipeline supports relevance to components, not a claim of platform-level equivalence.
- **No general optimizer has been implemented or proved here.** The new artifact is a reproducible research harness plus this design assessment. A canonical schedule for the tested independent family is demonstrated; the more general algorithm remains proposed.

The most promising next deliverable is therefore an **explanatory, compiler-backed opportunity report**, with a small first class of certified construction-region moves. That preserves the original intuition—a readable normal form that helps memoization—while replacing the unsupported universal category-order premise with explicit, testable invariants.

## Primary sources

Start with the [maintainer's source-order explanation][order-issue], [design goals][design-goals], [mutability model][mutability-model], and [pinned OXC pipeline][oxc-pipeline]. The implementation and research references are linked at their points of use above.

[oxc-package]: https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/napi/transform-react/package.json#L1-L23
[oxc-provenance]: https://registry.npmjs.org/-/npm/v1/attestations/oxc-transform-react@0.156.0
[babel-metadata]: https://registry.npmjs.org/babel-plugin-react-compiler/1.0.0
[oxc-unknown-call]: https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler_inference/infer_mutation_aliasing_effects.rs#L1886-L1955
[oxc-api]: https://unpkg.com/oxc-transform-react@0.156.0/README.md
[oxc-pipeline]: https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler/entrypoint/pipeline.rs#L142-L308
[oxc-scopes]: https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler_inference/infer_reactive_scope_variables.rs#L35-L99
[oxc-overlap]: https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler_inference/merge_overlapping_reactive_scopes_hir.rs#L169-L246
[oxc-hooks]: https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler_inference/flatten_scopes_with_hooks_or_use_hir.rs#L6-L98
[oxc-dependencies]: https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler_inference/propagate_scope_dependencies_hir.rs#L42-L114
[oxc-merge]: https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler_reactive_scopes/merge_reactive_scopes_that_invalidate_together.rs#L151-L275
[mutability-model]: https://github.com/facebook/react/blob/5c15c1cd3442f28044217703b5625f98c40042ee/compiler/packages/babel-plugin-react-compiler/src/Inference/MUTABILITY_ALIASING_MODEL.md
[design-goals]: https://github.com/facebook/react/blob/c0c29e89066df60c8340d4e853d38b5843c165ab/compiler/docs/DESIGN_GOALS.md
[order-issue]: https://github.com/react/react/issues/35237#issuecomment-3880689584
[split-comment]: https://github.com/react/react/issues/35237#issuecomment-3880954378
[consumer-issue]: https://github.com/react/react/issues/36848
[old-scheduler]: https://github.com/facebook/react/blob/5c15c1cd3442f28044217703b5625f98c40042ee/compiler/packages/babel-plugin-react-compiler/src/Optimization/InstructionReordering.ts#L31-L70
[scheduler-removal]: https://github.com/react/react/commit/b16b768fbd95fff334b15d36b8f141010d68869e
[react-mcp]: https://github.com/react/react/blob/d71b537241d26861df496413db2142c7ba192c25/compiler/packages/react-mcp-server/src/index.ts
[logger]: https://react.dev/reference/react-compiler/logger
[sprout]: https://github.com/facebook/react/blob/5c15c1cd3442f28044217703b5625f98c40042ee/compiler/packages/snap/src/sprout/README.md
[pdg]: https://research.ibm.com/publications/the-program-dependence-graph-and-its-use-in-optimization
[gcm]: https://doi.org/10.1145/207110.207154
[lcm]: https://doi.org/10.1145/143095.143136
[prepack-effects]: https://github.com/facebookarchive/prepack/wiki/Effects
[self-adjusting]: https://arxiv.org/abs/1106.0478
[adapton]: https://doi.org/10.1145/2594291.2594324
[cts]: https://link.springer.com/chapter/10.1007/978-3-030-17184-1_20
[egg]: https://egraphs-good.github.io/egg/egg/tutorials/_01_background/index.html
[purity]: https://react.dev/reference/rules/components-and-hooks-must-be-pure
[effect-memoization]: https://react.dev/reference/react/useMemo#preventing-an-effect-from-firing-too-often
[oxc-loops]: https://github.com/oxc-project/oxc/blob/75efdca4747c4ad9b252542743098d4894f8005b/crates/oxc_react_compiler/src/react_compiler_inference/flatten_reactive_loops_hir.rs#L6-L49
