# Component ordering POC

Tracks [App issue 105956](https://github.com/Expensify/App/issues/105956).

## Outcome

**Autofix experiment:** [Repo-wide App run and selected before/after examples](./autofix-showcase.md). The rule now fixes a limited class of inert declarations; arbitrary calculations remain report-only.

**Targeted follow-up POC:** [Compiler-backed opportunity reporter and real App validation](./opportunity-poc.md).

**Follow-up research:** [Static optimization investigation](./static-optimization-research.md) uses OXC and compiler-disabled controls. It demonstrates that the category-order rule can recommend a memoization regression; intact construction regions, invalidation precision, and demand matter more than category rank.

Ordering can improve compiler caching, but **not reliably as a general rule**. Runtime tests show an allocation/mutation chain improving from six executions to one, an already-cached control staying unchanged, and a normal handler/effect ordering change staying unchanged. Splitting the allocation/mutation chain has the inverse effect. The pinned real footer experiment adds two small call guards but does not cache its four totals reducers. See [validation-results.md](./validation-results.md) for evidence and limitations.

The rule is an **opt-in readability diagnostic with conservative fixes**, not a performance guarantee. Validate changes with the real compiler, output comparisons, and runtime profiling. The experimental branch contains the whole-repo result for inspection, not a recommendation to deploy it wholesale. [PR 106100](https://github.com/Expensify/App/pull/106100) informed the generated-call-guard analysis; its proposed regression checker is not vendored or required here.

## Rule

Implementation: `eslint-plugin-expensify/component-body-order.js`. It is discovered by the existing `rulesdir` loader, including App's Oxlint adapter, but **not enabled in shared defaults**.

```js
// Add to an existing config that loads Expensify's rulesdir rules:
{'rulesdir/component-body-order': 'warn'}
```

For an isolated Oxlint run using this checkout's rule (no App config modifications):

```sh
node ../App/node_modules/oxlint/bin/oxlint \
  --config benchmarks/component-body-order/oxlint.json \
  --disable-nested-config --threads 1 ../App/src
```

Preferred categories: inputs/context → subscriptions → state/refs → derived values → handlers → effects → render.

### Deliberately conservative scope

- Checks top-level, conventionally named components/custom hooks, including `memo`/`forwardRef` callbacks and anonymous default exports returning JSX.
- Computes a complete eligible permutation in one fix, preserving the relative order of hooks. Each swap reduces category inversions, so repeated fixing stabilizes. If nothing is safely fixable, reports one ordering warning per function.
- Known hooks are classified by name, including aliases, namespaces, and transparent TypeScript wrappers. Unknown `useX` hooks are treated as generic inputs, not proven subscriptions; categorization is heuristic.
- Never recommends swapping two recognized hooks. Nested evaluated hook expressions, IIFEs, unresolved computed calls, unclassified statements, mutable/multiple declarations, and control-flow boundaries block advice.
- Suppresses movements across references between the two declarations, including closure captures. This is **not** a purity, alias, mutation, or behavioral-equivalence proof. The warning explicitly requires evaluation-order review.
- `--fix` moves only single-binding `const` function/arrow creations or primitive-literal computations, across other eligible declarations or hooks. It rejects mutable/captured bindings, function-property operations, unknown-call escapes, dependent declarations, comments/directives, direct eval, and control-flow barriers. It preserves ASI boundaries. Function bodies are moved as complete declarations; their work is not executed by the movement.
- Calls, getters, array/object constructions, and later mutation chains are not automatically moved. In particular, the known allocation-before-effect regression remains unfixed. Other ordering warnings still require manual evaluation-order review.
- Does not analyze multi-statement derived blocks such as the motivating `let footerData; if (...) ...` calculation. The footer experiment is independent of the lint diagnostic and is not a claim that this POC detects that complete case.
- Arbitrary indirect/dynamically aliased hooks and custom wrappers are outside the syntactic detection scope. Lowercase utilities and nested functions are skipped; uppercase non-components can be classified as components.

## Reproduce validation

Use Node 24.22.1+ and install this repository's dependencies (`npm ci`). App needs its own existing dependencies; these scripts do not install packages or modify App.

```sh
npm test -- --runInBand eslint-plugin-expensify/tests/component-body-order.test.js
node benchmarks/component-body-order/verify-oxlint.mjs --app ../App
node benchmarks/component-body-order/verify-oxlint-autofix.mjs --app ../App
node benchmarks/component-body-order/validate-memoization.mjs --app ../App --footer
node benchmarks/component-body-order/run.mjs --app ../App --samples 9
```

The footer experiment additionally needs the pinned Git blob in App's object database, as described in its results. Runtime counter tests use real React rendering, assert output and reference identity on unrelated rerenders, and assert invalidation on changed inputs. They do not establish browser/native timings.

## Historical diagnostic-only Oxlint benchmark

This section records the earlier diagnostic-only implementation. The current autofix-capable rule is measured separately in [autofix-lint-benchmark.json](./autofix-lint-benchmark.json); do not treat these timings as interchangeable.

Corpus: only tracked `src` files from App commit `b14f3591fad1db21c32271e79e9fe66b433fc5dc`, extracted outside App's dirty working tree: **8,591 files**. Apple M5 Max, macOS arm64, Node 24.22.1, Oxlint 1.90.0. Each mode uses a fresh process, one thread, two warmups, nine measured runs, alternating mode order. Output JSON is captured and parsed, so timings include startup, source reading, parsing, the JS bridge, diagnostic serialization and process teardown—not just rule callbacks.

| Mode | Enabled rules | Median wall time |
| --- | ---: | ---: |
| Parse-only baseline | 0 | 650 ms |
| No-op JS plugin with the same visitor types | 1 | 1,982 ms |
| Rule before optimization (`71cd5d1`) | 1 | 2,338 ms |
| Optimized rule | 1 | 2,297 ms |

Raw runs and diagnostic hashes: [benchmark-results.json](./benchmark-results.json). Both rule implementations emit exactly the same **1,754 diagnostics**, verified by a deterministic SHA-256 comparison. This is candidate volume, **not a validated false-positive rate**.

The optimized rule's median is about **41 ms / 1.8% faster end-to-end** in this paired run. Its overhead above the no-op bridge is about **315 ms** (versus 356 ms before optimization), including diagnostic production/serialization. These are modest local measurements with overlapping run ranges and visible machine-load outliers, not a statistically established or universal speedup or a full-lint overhead prediction. The no-op bridge itself adds about 1.3 seconds here; its standalone cost is not necessarily additive when other App JS plugins already run.

### Optimizations explored

- Reject ineligible function names before touching function bodies, reducing lazy AST materialization.
- Stream statement classification and stop at the first report instead of building a complete classification array.
- Allocate declaration caches only for actual inversions; do not request scope analysis on already ordered pairs.
- Resolve import-alias scopes only for actual renames, caching by identifier. Ordinary `useState` imports need no alias lookup.
- Cache statement bounds outside reference predicates; avoid parameter filter/map/Set allocations.
- Keep evaluated-hook inspection local to potential inversions and skip unevaluated callback bodies.

The historical diagnostic avoided full dependency graphs and compiler calls inside lint. Autofix adds conservative scope/reference checks and whole-function ordering work. Benchmark further changes against the JS bridge baseline, not only a JavaScript-loop microbenchmark.

To benchmark the current rule on the historical corpus:

```sh
git -C ../App archive b14f3591fad1db21c32271e79e9fe66b433fc5dc src | tar -x -C "$CORPUS_DIR"
node benchmarks/component-body-order/run.mjs --app ../App \
  --target "$CORPUS_DIR/src" --samples 9 \
  --output benchmark-results.json
```

Create an empty scratch `$CORPUS_DIR` first. The harness asserts zero/one enabled rules, checks diagnostics, disables nested configs, and only deletes temporary config files it creates. `--compare-ref` loads the historical rule from this repository's Git objects without checkout/reset. Benchmark controls and raw samples make measurement noise visible.
