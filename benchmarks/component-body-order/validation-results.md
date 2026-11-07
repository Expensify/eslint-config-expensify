# Component body ordering: memoization validation

## Reproduce

From `eslint-config-expensify`:

```sh
eval "$(fnm env)"
fnm use 24.22.1
./node_modules/.bin/eslint benchmarks/component-body-order/validate-memoization.mjs benchmarks/component-body-order/validate-footer-ordering.mjs
node benchmarks/component-body-order/validate-memoization.mjs --app /Users/rory/Expensidev/App
node benchmarks/component-body-order/validate-memoization.mjs --app /Users/rory/Expensidev/App --footer
node --check benchmarks/component-body-order/validate-memoization.mjs
node --check benchmarks/component-body-order/validate-footer-ordering.mjs
```

All assertions passed. The harness prints JSON to stdout and React's test-renderer deprecation warnings to stderr. It resolves dependencies from the supplied App checkout with `createRequire`, loads App's shared compiler configuration, compiles in memory, and evaluates CommonJS lowered by esbuild. It neither installs packages nor writes App files. `--footer` additionally requires the pinned source blob in App's local Git object database; it does not fetch or read the working-tree component.

Observed environment: Node 24.22.1; local ESLint 9.36.0; `oxc-transform-react` 0.156.0; React and react-test-renderer 19.2.3; esbuild 0.28.1. Configuration: React 19 target, ref-like identifiers enabled, empty suppression-rule list, `panicThreshold: 'none'`. Compiler diagnostics must be empty, and each generated fixture must import the compiler runtime.

## Runtime results

Each variant mounts once, performs five unrelated parent updates with the same frozen input array, then updates the actual input. Assertions cover exactly seven component renders, helper-call counts, rendered text, list contents, handler results, object/list/handler identities, dependency invalidation, and unchanged hook sequence. Strict Mode is not enabled.

| Fixture | `buildList`: mount + five unrelated renders, before → after | After changed input, before → after | Object/list/handler stable, before → after |
| --- | --- | --- | --- |
| Join allocation and mutation after a hook | 6 → 1 | 7 → 2 | no → yes |
| Negative control: allocation already cached | 1 → 1 | 2 → 2 | yes → yes |
| Category-compliant handler-before-effect order | 1 → 1 | 2 → 2 | yes → yes |
| Harmful allocation split across a hook | 1 → 6 | 2 → 7 | yes → no |

`formatLabels` runs once before the input change and twice afterward in every variant. This is an additional already-cached control.

The positive case moves the derived `labels` and `list` declarations from before `useThing()` to after it, keeping `list.push(1)` with the allocation. `buildList` returns a fresh slice; `useThing` calls real React `useState`. The emitted `buildList` call changes from unguarded to inside `if ($[slot] !== items)`. The harness asserts those generated guard counts as well as runtime behavior. The harmful fixture is the inverse transformation, not an independent failure mechanism or a rule-recommended change: splitting allocation from subsequent mutation loses the guard without changing list contents. Hook order is preserved throughout.

The neutral category example moves `const countItems = () => list.length` before an unrelated `useEffect`. Both placements already memoize the list and handler. These results support an allocation/mutation-boundary hypothesis, not a claim that every preferred-order change improves performance.

## Connection to the POC rule

The harness imports `../../eslint-plugin-expensify/component-body-order.js` directly and runs the target repository's ESLint `Linter` with its TypeScript parser. It asserts diagnostic counts and messages, not just absence of parse errors:

- Positive and already-cached controls: exactly one `order` diagnostic for inputs/context following derived values; zero after moving the declarations.
- Neutral handler-before-effect pair: exactly one `order` diagnostic for handlers following effects; zero afterward.
- Harmful inverse pair: zero before; exactly one diagnostic afterward. JSON explicitly labels it `ruleRecommended: false` as a warning against naive reordering, not evidence that this POC recommends the harmful transformation.

These remain independently authored source pairs, not automatically generated fixes. The assertions tie their diagnostic shape to the live POC rule without claiming its report is a complete or safe rewrite plan.

## Exact footer source: ordering changes isolated

Source: `src/components/Search/SearchSelectionFooter.tsx` at `d0dc7d0ef16ada442fc402301f25ed57427b33b9`, the base returned by GitHub for [PR 105897](https://github.com/Expensify/App/pull/105897). The comparison applies only source-block moves in memory. It leaves the inline `getEmptyObject` default and every other non-ordering fix untouched. Source whitespace-token multisets and emitted hook sequences must match the baseline.

| Isolated transformation | Generated call-guard changes |
| --- | --- |
| Move the complete `footerData` calculation before effects | One `Object.keys` and one `isGroupEntry` call become guarded |
| Move selection-derived calculations after the existing ref/subscription hooks | None |
| Combine those ordering transformations | Same two guarded calls as totals-only |

The four direct reducer calls (`selectedReportIDs.reduce`, `selectedTransactionsKeys.reduce`, `excludedReportIDs.reduce`, `excludedKeysForTotal.reduce`) remain outside compiler cache guards in every variant. They may still be conditional on ordinary application branches. Ordering alone does **not** demonstrate restoration of totals caching with this compiler/configuration. This experiment does not evaluate the other PR fixes or establish which additional change would restore it.

## Limitations

- This is a semantic/counter validation harness, not a timing benchmark, lint-rule test, autofix proof, or device/browser performance measurement.
- Fixture sources are explicitly authored before/after pairs. The harness invokes the live ordering rule for diagnostics, but does not apply an automatic fix.
- The real footer comparison is compile-only. It does not render the footer, mock its subscriptions, or prove behavioral equivalence. Hook-sequence and source-token checks are safeguards, not general dependency analysis.
- The small generated-code analyzer recognizes the current compiler's `$` cache guards, skips nested functions, normalizes compiler temporary names, and aggregates direct calls by callee. It cannot prove correct dependency sets or identify a particular callsite among identical callees. It is intentionally narrower than a production regression checker.
- Expectations depend on the installed compiler/configuration; future versions may require investigation and updated fixtures rather than implying an App regression.
- React test-renderer is deprecated; its warning is expected. No Strict Mode, concurrent interruption, native rendering, or production-bundle timing is covered.
- Categorization must not override data dependencies, side effects, or hook order. The harmful inverse fixture illustrates why allocation and mutation must not be moved independently.
