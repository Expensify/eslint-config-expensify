# Native runtime notes: actual autofixed LegalNameStep

`validate-autofix-showcases.mjs` passed on native Node **26.13.0**, OXC **0.156.0**, React **19.2.3**, and react-test-renderer **19.2.3**.

## Sources and method

- Component: `src/pages/AddPersonalBankAccountPage/substeps/LegalNameStep.tsx`.
- Before: full module from `git show df1e765feee11ea8983554979da24405a4b39411:<path>`.
- After: full actual file in `/Users/rory/Expensidev/App-Worktrees/component-order-autofix`, read without modifying App.
- SHA-256 before: `30167f0d25840489ac96f01ccaa0a0a7a626020019cc03b6a1f54e7df53d18e5`.
- SHA-256 after: `91f6b46d85f4ce3e2ea7473b699c2dc8093e760ea643594630e877826385a266`.
- The script verifies the source token multiset is unchanged and the App compiler configuration matches the base. It evaluates four variants: before/after, each with React Compiler enabled/disabled. OXC removes types and transforms JSX; esbuild only converts its output to CommonJS for evaluation.
- React, JSX runtime, compiler runtime, effects, callbacks, and renderer are real installed packages. `FullNameStep` is an inert host element. Localization, Onyx, and the submit hook are controlled mocks; unexpected imports fail. Form input IDs come from the full base `PersonalBankAccountForm.ts` module.
- No source-body instrumentation, compiler-output rewriting, or replacement memo cache is used. Each variant is mounted as a real React component and unmounted after its sequence.

## Assertions and observations

Every variant passes **18 renders, 18 submissions, and 54 callback invocations**:

1. Initial legal names `Ada` / `Lovelace`, stable rerender, unrelated prop, and a new personal-details object with identical names.
2. Independent first-name and last-name changes (`Grace` / `Lovelace`, then `Grace` / `Hopper`).
3. Missing first name, missing last name, missing details, null names, empty strings, and stable empty strings. Expected default strings are explicit test data.
4. Independent `onNext`, `onMove`, editing, offline, and translator changes, followed by revisiting the initial inputs.

Each render checks the complete child prop contract, exact current callback identities, submit-hook arguments (`legalFirstName`, `legalLastName`, `onNext`, `shouldSaveDraft`), unchanged submission object identity, and callbacks/arguments. Submissions use values distinct from defaults, detecting accidental default-value submission. Updating callbacks/editing exercises fresh mock-handler closures.

All four variants have identical outputs, hook order, submit arguments, callback traces, and mock-effect timing. The mock Onyx subscription sets up once and cleans up on unmount. The submit mock effect sets up four times with matching cleanups: initial `nextA/false`, `nextB/false`, `nextB/true`, then `nextA/false`. Changes unrelated to those dependencies do not restart it.

| Observation | Before compiled | After compiled | Either compiler-disabled control |
| --- | ---: | ---: | ---: |
| Static cache slots | 21 | 19 | 0 |
| Static cache guards | 6 | 5 | 0 |
| Static guarded `getDefaultValues()` call sites | 1 | 1 | 0 |
| Renders reusing the preceding default-values object | 9 / 18 | 9 / 18 | 0 / 18 |
| Translation mock calls | 6 | 6 | 36 |

The before output separately caches the `getDefaultValues` closure and guards its invocation by function identity. The after output creates/invokes that closure together under the legal-name dependency guard. Both calls are already guarded; this is **cache-structure simplification**, not a newly memoized expensive operation. Returned default-object identity is observed directly; internal closure invocations are not instrumented or counted. The two compiled variants have exactly equal observed traces, including default-object reuse and translation counts.

## Scope

This proves the tested component-level contract under these controlled mocks. It is native **Node** execution, not React Native device execution. It does not verify the real child form, validation, Onyx subscriptions, persistence, bank-account API behavior, browser UI, or device UI. Mock effect checks verify dependency forwarding and ordering, not production hook implementation. There is no timing benchmark and **no latency-gain claim**.

## Commands

From `eslint-config-expensify`, with a native Node 24 or 26 executable:

```sh
/opt/homebrew/bin/node benchmarks/component-body-order/validate-autofix-showcases.mjs \
  --app /Users/rory/Expensidev/App-Worktrees/component-order-autofix \
  --output /private/var/folders/lx/k606j6cd5356xrd4m1f3b5_h0000gn/T/opencode/autofix-showcase-results.json

/opt/homebrew/bin/node node_modules/eslint/bin/eslint.js \
  benchmarks/component-body-order/validate-autofix-showcases.mjs
```

Both passed. React prints its test-renderer deprecation notice; lint prints existing dependency-age/React-autodetection notices. The JSON report includes versions, configuration, source hashes, static predicates, and complete per-variant runtime traces.
