/* eslint-disable no-console, no-await-in-loop, rulesdir/prefer-underscore-method -- Sequential differential experiments use native collections and print evidence. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {runInThisContext} from 'node:vm';
import {analyzeSource} from '../../tooling/memoization/analyze.mjs';
import {collectCompiledCalls} from './validate-footer-ordering.mjs';

const pin = 'b14f3591fad1db21c32271e79e9fe66b433fc5dc';
const {values} = parseArgs({options: {app: {type: 'string'}, output: {type: 'string'}}});
assert(values.app, 'Pass --app /path/to/App (local Git objects and installed dependencies required)');
const app = path.resolve(values.app);
const requireApp = createRequire(path.join(app, 'package.json'));
const React = requireApp('react');
const PropTypes = requireApp('prop-types');
const {act, create} = requireApp('react-test-renderer');
const {transformSync} = requireApp('oxc-transform-react');
const esbuild = requireApp('esbuild');
const {parse} = requireApp('@babel/parser');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function pinnedSource(filename, blob) {
    const actual = execFileSync('git', ['rev-parse', `${pin}:${filename}`], {cwd: app, encoding: 'utf8'}).trim();
    assert.equal(actual, blob, `${filename}: pinned blob`);
    return execFileSync('git', ['show', `${pin}:${filename}`], {cwd: app, encoding: 'utf8'});
}

function evaluate(code, imports) {
    const module = {exports: {}};
    const run = runInThisContext(`(function(require, module, exports) {\n${code}\n})`);
    run((id) => {
        if (id.startsWith('react/')) {
            return requireApp(id);
        }
        assert(Object.hasOwn(imports, id), `Unmocked runtime import: ${id}`);
        return imports[id];
    }, module, module.exports);
    return module.exports;
}

const config = evaluate(pinnedSource('config/babel/oxcReactCompilerConfig.js', '1f1978309f1b0dc417a7253e3214c648da05deec'), {});
const versions = {
    node: process.version,
    oxc: requireApp('oxc-transform-react/package.json').version,
    babel: requireApp('@babel/core/package.json').version,
    babelCompiler: requireApp('babel-plugin-react-compiler/package.json').version,
    react: React.version,
    renderer: requireApp('react-test-renderer/package.json').version,
};
assert.equal(versions.oxc, '0.156.0', 'Rebaseline compiler assertions explicitly when upgrading');
assert.equal(versions.babelCompiler, '1.0.0', 'The reporter HIR adapter is version-specific');
assert.equal(versions.react, '19.2.3');
assert.equal(versions.renderer, versions.react);
const reporterEngines = {
    babel: requireApp('@babel/core'),
    babelCompiler: requireApp('babel-plugin-react-compiler'),
    oxc: requireApp('oxc-transform-react'),
    config,
};

function uniqueIndex(text, marker) {
    const index = text.indexOf(marker);
    assert(index >= 0 && text.indexOf(marker, index + 1) === -1, `Expected exactly one marker: ${marker}`);
    return index;
}

function move(text, startMarker, endMarker, destinationMarker) {
    const start = uniqueIndex(text, startMarker);
    const end = uniqueIndex(text, endMarker);
    assert(end > start);
    const block = text.slice(start, end);
    const remaining = text.slice(0, start) + text.slice(end);
    const destination = uniqueIndex(remaining, destinationMarker);
    const candidate = remaining.slice(0, destination) + block + remaining.slice(destination);
    assert.deepEqual(candidate.split(/\s+/).sort(), text.split(/\s+/).sort(), 'Only move existing source text');
    return candidate;
}

const cases = [
    {
        name: 'usePoliciesWithCardFeedErrors',
        filename: 'src/hooks/usePoliciesWithCardFeedErrors.ts',
        blob: '0842888c67d9e5b4c20c6f628a5b39b3a557d062',
        markers: ['    // If a policy was just deleted', '    const {shouldShowRbr', '    const policiesWithCardFeedErrors:'],
        operation: 'Object.values',
        reporterValue: 'cleanPolicies',
        reporterHook: 'useCardFeedErrors',
    },
    {
        name: 'RejectExpenseReportPage',
        filename: 'src/pages/RejectExpenseReportPage.tsx',
        blob: '04c66ad7f3d33982017f407342778d3877cef40d',
        // eslint-disable-next-line no-template-curly-in-string -- Match the pinned source's template literal exactly.
        markers: ['    const options = [];', '    const submitterName =', '    options.push({\n        text: `${submitterName}'],
        operation: 'options.push',
        reporterValue: 'options',
        reporterHook: 'usePersonalDetailByLogin',
    },
    {
        name: 'useWorkspaceAgentsTable',
        filename: 'src/hooks/useWorkspaceAgentsTable.ts',
        blob: '1a3937d6c5f1041f2c91613be84b45dbf9c51a23',
        markers: ['    const policyRoles =', '    const workspaceMembers =', '    const workspaceAgents:'],
        operation: 'Object.values',
        reporterValue: 'policyRoles',
        reporterHook: null,
    },
];

function compile(text, filename, enabled) {
    const result = transformSync(filename, text, {
        lang: filename.endsWith('.tsx') ? 'tsx' : 'ts',
        reactCompiler: enabled ? {...config(), reportDiagnostics: true} : false,
    });
    assert.equal(result.fatal, false);
    assert.deepEqual(result.errors, [], `${filename}: compiler diagnostics`);
    return result.code;
}

function cacheSummary(code, name) {
    return {
        ...collectCompiledCalls(code, parse, name),
        slots: Number((code.match(/const \$ = _c\((\d+)\)/) || [0, 0])[1]),
        predicates: code.split('\n').map(line => line.trim()).filter(line => line.startsWith('if ($[')),
    };
}

function reporterSummary(source, testCase) {
    const analysis = analyzeSource(source, testCase.filename, reporterEngines);
    assert.equal(analysis.babel.status, 'compiled', `${testCase.name}: reporter Babel compilation`);
    assert.equal(analysis.babel.failure, null);
    assert.deepEqual(analysis.babel.diagnostics, []);
    assert.deepEqual(analysis.babel.unconfirmedScopeChanges, []);
    assert(analysis.babel.functionsReachingTargetPass > 0, 'Reporter must reach the observed compiler pass');
    assert(analysis.babel.functions.some(fn => fn.name === testCase.name && fn.status === 'compiled'), 'Reporter must compile the target function');
    assert.equal(analysis.oxc.failure, null);
    assert.equal(analysis.oxc.fatal, false);
    assert.deepEqual(analysis.oxc.diagnostics, []);
    const matchingFindings = analysis.babel.findings.filter(finding => finding.function.name === testCase.name
        && finding.values.some(value => value.name === testCase.reporterValue)
        && (!testCase.reporterHook || finding.hooks.some(hook => hook.name === testCase.reporterHook)));
    return {
        babelStatus: analysis.babel.status,
        functionsReachingTargetPass: analysis.babel.functionsReachingTargetPass,
        totalFindings: analysis.babel.findings.length,
        matchingFindings: matchingFindings.map(finding => ({
            function: finding.function.name,
            values: finding.values.map(value => value.name),
            hooks: finding.hooks.map(hook => ({name: hook.name, location: hook.location})),
            location: finding.location,
            pass: finding.pass,
            afterKind: finding.afterKind,
            functionCompilation: finding.functionCompilation,
        })),
        oxc: analysis.oxc,
    };
}

function frozen(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value)) {
            frozen(child);
        }
        Object.freeze(value);
    }
    return value;
}

function policyEnvironment() {
    const policyA = frozen({id: 'a', policyAccountID: 10, admin: 'a@example.com'});
    const policyB = frozen({id: 'b', policyAccountID: 20, admin: 'b@example.com'});
    const policies = frozen({
        a: policyA, b: policyB, deleted: null, archived: {id: 'old', archived: true},
    });
    const policies2 = frozen({...policies, a: {...policyA, name: 'renamed'}});
    const errors = frozen({10: true, 20: false, 99: true});
    const errors2 = frozen({10: false, 20: true});
    const session = frozen({email: 'a@example.com'});
    const session2 = frozen({email: 'b@example.com'});
    const initial = {policies, errors, session};
    const sequence = [
        {label: 'mount', ...initial},
        {label: 'stable', ...initial},
        {label: 'unrelated', ...initial, noise: 1},
        {label: 'policiesOnly', ...initial, policies: policies2},
        {label: 'stablePolicies', ...initial, policies: policies2},
        {
            label: 'errorsOnly', ...initial, policies: policies2, errors: errors2,
        },
        {
            label: 'sessionOnly', policies: policies2, errors: errors2, session: session2,
        },
        {
            label: 'both', policies, errors, session: session2,
        },
        {label: 'revisit', ...initial},
    ];
    const counters = {archiveChecks: 0, adminChecks: 0};
    const lifecycle = [];
    const hooks = [];
    let input;
    const imports = {
        '@src/ONYXKEYS': {COLLECTION: {POLICY: 'policies'}, SESSION: 'session'},
        '@libs/PolicyUtils': {
            isArchivedPolicy(policy) {
                counters.archiveChecks += 1;
                return !!policy.archived;
            },
            isPolicyAdmin(policy, email) {
                counters.adminChecks += 1;
                return policy.admin === email;
            },
        },
        './useOnyx': (key) => {
            hooks.push(`useOnyx:${key}`);
            return [input[key]];
        },
        './useCardFeedErrors': function useCardFeedErrors() {
            hooks.push('useCardFeedErrors');
            const errorsSnapshot = input.errors;
            React.useEffect(() => {
                lifecycle.push(`setup:${JSON.stringify(errorsSnapshot)}`);
                return () => lifecycle.push(`cleanup:${JSON.stringify(errorsSnapshot)}`);
            }, [errorsSnapshot]);
            return {shouldShowRbrForWorkspaceAccountID: errorsSnapshot};
        },
    };
    return {
        sequence,
        counters,
        lifecycle,
        hooks,
        imports,
        setInput(value) { input = value; },
        props: () => ({}),
        project: result => result,
        reference: result => result.cleanPolicies,
        expected(value) {
            const cleanPolicies = Object.values(value.policies).filter(policy => policy && policy.id && !policy.archived);
            const errorsByID = Object.entries(value.errors).filter(([, hasErrors]) => hasErrors).map(([id]) => Number(id));
            const policiesWithCardFeedErrors = errorsByID.map(id => cleanPolicies.find(policy => policy.policyAccountID === id)).filter(Boolean);
            return {cleanPolicies, policiesWithCardFeedErrors, isPolicyAdmin: policiesWithCardFeedErrors.some(policy => policy.admin === value.session.email)};
        },
    };
}

function findElement(tree, type) {
    if (!tree || typeof tree !== 'object') {
        return undefined;
    }
    if (tree.type === type) {
        return tree;
    }
    return React.Children.toArray(tree.props && tree.props.children).map(child => findElement(child, type)).find(Boolean);
}

function pageEnvironment() {
    const previous = frozen({accountID: 20, displayName: 'Approver'});
    const submitter = frozen({accountID: 10, displayName: 'Submitter'});
    const initial = {
        previous, submitter, restricted: false, ownerAccountID: 10,
    };
    const sequence = [
        {label: 'mount', ...initial},
        {label: 'stable', ...initial},
        {label: 'unrelated', ...initial, restricted: true},
        {label: 'previousOnly', ...initial, previous: frozen({...previous, displayName: 'Approver two'})},
        {label: 'stablePrevious', ...initial, previous: frozen({...previous, displayName: 'Approver two'})},
        {label: 'submitterOnly', ...initial, submitter: frozen({...submitter, displayName: 'Submitter two'})},
        {label: 'ownerOnly', ...initial, ownerAccountID: 11},
        {label: 'revisit', ...initial},
    ];
    sequence[4].previous = sequence[3].previous;
    sequence[5].previous = sequence[3].previous;
    sequence[6].previous = sequence[3].previous;
    sequence[6].submitter = sequence[5].submitter;
    const counters = {displayNames: 0, lastApproverLabels: 0};
    const lifecycle = [];
    const hooks = [];
    let input;
    const translate = (key) => {
        if (key === 'iou.rejectReport.lastApprover') {
            counters.lastApproverLabels += 1;
        }
        return key;
    };
    const displayName = ({passedPersonalDetails}) => {
        counters.displayNames += 1;
        return passedPersonalDetails ? passedPersonalDetails.displayName : '';
    };
    const noop = () => {};
    const styles = frozen({});
    const currentUser = frozen({accountID: 30, displayName: 'Current'});
    const emails = frozen({submitterEmail: 'submitter@example.com', lastForwardedActorEmail: 'approver@example.com'});
    const imports = {
        react: {...React, useState: (...args) => { hooks.push('useState'); return React.useState(...args); }, useRef: (...args) => { hooks.push('useRef'); return React.useRef(...args); }},
        'react-native': {View: 'View'},
        '@src/CONST': {DEFAULT_NUMBER_ID: 0, BUTTON_VARIANT: {DANGER: 'danger'}},
        '@src/ONYXKEYS': {
            COLLECTION: {
                REPORT: 'report_', POLICY: 'policy_', REPORT_ACTIONS: 'actions_', RULE: 'rules',
            },
            FORMS: {REPORT_REJECT_FORM: 'reject'},
            NVP_INTRO_SELECTED: 'track',
        },
        '@src/types/form/ReportRejectForm': {COMMENT: 'comment'},
        '@src/types/utils/EmptyObject': {getEmptyObject: () => ({})},
        '@src/selectors/RejectExpenseReport': {currentCycleForwardedActorAccountIDsSelector: noop, submitterAndLastForwardedActorEmailSelector: noop},
        '@selectors/Onboarding': {isTrackIntentUserSelector: noop},
        '@styles/variables': {textInputAutoGrowMaxHeight: 100},
        '@libs/getNonEmptyStringOnyxID': id => id || '',
        '@libs/PersonalDetailsUtils': {temporaryGetDisplayNameOrDefault: displayName},
        '@libs/Navigation/Navigation': {goBack: noop},
        '@userActions/IOU/RejectMoneyRequest': {rejectExpenseReport: noop},
        '@components/DelegateNoAccessModalProvider': {
            useDelegateNoAccessState: () => { hooks.push('useDelegateNoAccessState'); return {isDelegateAccessRestricted: input.restricted}; },
            useDelegateNoAccessActions: () => { hooks.push('useDelegateNoAccessActions'); return {showDelegateNoAccessModal: noop}; },
        },
        '@hooks/usePersonalDetails': {useAllPersonalDetails: () => { hooks.push('useAllPersonalDetails'); return [emails]; }},
    };
    const components = [
        'Form/FormProvider', 'Form/InputWrapper', 'FormHelpMessage', 'HeaderWithBackButton', 'ScreenWrapper', 'SelectionList', 'SelectionList/ListItem/UserListItem', 'Text', 'TextInput',
    ];
    for (const component of components) {
        imports[`@components/${component}`] = component;
    }
    const mockHooks = {
        useLocalize: () => ({translate, formatPhoneNumber: noop}),
        useThemeStyles: () => styles,
        useAutoFocusInput: () => ({inputCallbackRef: noop}),
        useCurrentUserPersonalDetails: () => currentUser,
        useDelegateAccountID: () => 0,
        useOnyx: key => [key === 'report_r' ? {ownerAccountID: input.ownerAccountID, policyID: 'p'} : undefined],
        usePersonalDetailByLogin: (email, selector) => {
            React.useEffect(() => {
                lifecycle.push(`setup:${email}`);
                return () => lifecycle.push(`cleanup:${email}`);
            }, [email]);
            const details = email === emails.submitterEmail ? input.submitter : input.previous;
            return selector ? selector(details) : details;
        },
    };
    for (const [name, implementation] of Object.entries(mockHooks)) {
        imports[`@hooks/${name}`] = (...args) => {
            hooks.push(name);
            return implementation(...args);
        };
    }
    return {
        sequence,
        counters,
        lifecycle,
        hooks,
        imports,
        setInput(value) { input = value; },
        props: () => ({route: {params: {reportID: 'r'}}}),
        project: tree => findElement(tree, 'SelectionList').props.data,
        reference: tree => findElement(tree, 'SelectionList').props.data,
        expected(value, selected = '') {
            return [
                {
                    text: `${value.previous.displayName} (iou.rejectReport.lastApprover)`,
                    alternateText: emails.lastForwardedActorEmail,
                    keyForList: '20',
                    accountID: 20,
                    isSelected: selected === '20',
                },
                {
                    text: `${value.submitter.displayName} (iou.rejectReport.submitter)`,
                    alternateText: emails.submitterEmail,
                    keyForList: String(value.ownerAccountID),
                    accountID: value.ownerAccountID,
                    isSelected: selected === String(value.ownerAccountID),
                },
            ];
        },
        async exercise(tree, getCurrent) {
            await act(() => findElement(tree, 'SelectionList').props.onSelectRow({keyForList: '20'}));
            assert.deepEqual(this.project(getCurrent()), this.expected(input, '20'), 'Real useState selection update');
            const form = findElement(getCurrent(), 'Form/FormProvider');
            form.props.onBeforeSubmit();
            await act(() => assert.deepEqual(form.props.validate({comment: 'reason'}), {}));
        },
    };
}

async function measure(code, environment) {
    const env = environment();
    const implementation = evaluate(esbuild.transformSync(code, {format: 'cjs'}).code, env.imports).default;
    let current;
    let root;
    let renders = 0;
    function Probe({tick}) {
        renders += 1;
        current = implementation(env.props());
        return React.createElement('span', null, `${tick}:${JSON.stringify(env.project(current))}`);
    }
    Probe.propTypes = {tick: PropTypes.number.isRequired};
    const samples = [];
    let expectedHooks;
    async function render(tick) {
        await act(() => {
            const element = React.createElement(Probe, {tick});
            if (root) {
                root.update(element);
            } else {
                root = create(element);
            }
        });
    }
    try {
        for (let tick = 0; tick < env.sequence.length; tick++) {
            const input = env.sequence[tick];
            const previous = current && env.reference(current);
            const hookStart = env.hooks.length;
            env.setInput(input);
            await render(tick);
            const value = env.project(current);
            assert.deepEqual(value, env.expected(input), `${input.label}: source output`);
            assert.deepEqual(root.toJSON().children, [`${tick}:${JSON.stringify(value)}`]);
            const hooks = env.hooks.slice(hookStart);
            expectedHooks ??= hooks;
            assert.deepEqual(hooks, expectedHooks, `${input.label}: runtime hook order`);
            samples.push({
                label: input.label, value, sameReference: !!previous && env.reference(current) === previous, counters: {...env.counters},
            });
        }
        assert.equal(renders, env.sequence.length, 'Every parent update rendered');
        if (env.exercise) {
            await env.exercise(current, () => current);
        }
    } finally {
        if (root) {
            await act(() => root.unmount());
        }
    }
    return {
        samples, lifecycle: env.lifecycle, hooks: expectedHooks, counters: env.counters, renders,
    };
}

const results = [];
for (const testCase of cases) {
    const original = pinnedSource(testCase.filename, testCase.blob);
    const candidate = move(original, ...testCase.markers);
    const code = {};
    for (const [name, source] of Object.entries({original, candidate})) {
        code[`${name}Source`] = compile(source, testCase.filename, false);
        code[`${name}Compiled`] = compile(source, testCase.filename, true);
    }
    const before = cacheSummary(code.originalCompiled, testCase.name);
    const after = cacheSummary(code.candidateCompiled, testCase.name);
    const sourceHooks = cacheSummary(code.originalSource, testCase.name).hooks;
    for (const text of Object.values(code)) {
        assert.deepEqual(cacheSummary(text, testCase.name).hooks, sourceHooks, 'Static hook order');
    }
    const result = {
        name: testCase.name, filename: testCase.filename, blob: testCase.blob, before, after, runtime: {},
    };
    result.reporter = {
        value: testCase.reporterValue,
        hook: testCase.reporterHook,
        before: reporterSummary(original, testCase),
        after: reporterSummary(candidate, testCase),
    };
    assert.equal(result.reporter.after.matchingFindings.length, 0, 'Candidate has no matching construction/hook finding');
    result.diagnostics = [];
    const environment = testCase.name === 'usePoliciesWithCardFeedErrors' ? policyEnvironment : pageEnvironment;
    if (testCase.name === 'useWorkspaceAgentsTable') {
        assert.equal(result.reporter.before.matchingFindings.length, 0, 'Negative control: no policyRoles finding');
        assert.equal(result.reporter.before.totalFindings, 0);
        assert.equal(result.reporter.after.totalFindings, 0);
        assert.deepEqual(before.calls, after.calls, 'Negative control: call guards unchanged');
        assert.equal(before.slots, after.slots, 'Negative control: slot count unchanged');
        result.runtime = null;
    } else {
        assert(result.reporter.before.matchingFindings.length > 0, 'Original source reports the expected named value and hook');
        assert(before.calls[testCase.operation].unguarded > 0);
        assert.equal(after.calls[testCase.operation].unguarded, 0);
        for (const [name, text] of Object.entries(code)) {
            result.runtime[name] = await measure(text, environment);
        }
        const baseline = result.runtime.originalSource;
        for (const run of Object.values(result.runtime)) {
            assert.deepEqual(run.samples.map(sample => sample.value), baseline.samples.map(sample => sample.value), 'Four-way values');
            assert.deepEqual(run.lifecycle, baseline.lifecycle, 'Four-way mock effect setup/cleanup');
            assert.deepEqual(run.hooks, baseline.hooks, 'Four-way runtime hook order');
        }
        assert.deepEqual(result.runtime.candidateSource, baseline, 'Source move preserves the observed trace, including reference churn');
        assert(result.runtime.originalCompiled.samples.slice(1).every(sample => !sample.sameReference), 'Original escaping array is rebuilt');
        assert.deepEqual(result.runtime.candidateCompiled.samples.slice(1, 3).map(sample => sample.sameReference), [true, true], 'Stable and unrelated inputs reuse array');
        const changingSamples = result.runtime.candidateCompiled.samples.slice(3).filter(sample => !sample.label.startsWith('stable'));
        assert(changingSamples.every(sample => !sample.sameReference), 'Relevant independent changes rebuild array');
        if (testCase.name === 'usePoliciesWithCardFeedErrors') {
            assert.deepEqual([before.slots, after.slots], [0, 4]);
            assert.deepEqual(after.predicates, ['if ($[0] !== policies || $[1] !== session?.email || $[2] !== shouldShowRbrForWorkspaceAccountID) {']);
            assert.equal(result.runtime.originalCompiled.counters.archiveChecks, 27);
            assert.equal(result.runtime.candidateCompiled.counters.archiveChecks, 18);
            assert.equal(result.runtime.candidateCompiled.counters.adminChecks, 6);
            assert.equal(baseline.lifecycle.length, 6, 'Three mocked subscription setups and cleanups');
        } else {
            assert.deepEqual([before.slots, after.slots], [98, 117]);
            const optionsGuard = after.predicates.find(predicate => predicate.includes('!== hasPreviousApprover') && predicate.includes('!== submitterName'));
            assert(optionsGuard && optionsGuard.includes('!== selectedTargetAccountID') && optionsGuard.includes('!== previousApprover'));
            assert.equal(result.runtime.candidateCompiled.samples.filter(sample => !sample.sameReference).length, 5, 'Five option constructions in eight parent updates');
            assert.deepEqual(baseline.lifecycle, [
                'setup:approver@example.com', 'setup:submitter@example.com', 'cleanup:approver@example.com', 'cleanup:submitter@example.com',
            ]);
        }
    }
    results.push(result);
}
const report = {
    pin, versions, config: config({reportDiagnostics: true}), results,
};
if (values.output) {
    fs.writeFileSync(values.output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
