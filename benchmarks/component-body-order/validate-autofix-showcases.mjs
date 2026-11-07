/* eslint-disable no-console, no-await-in-loop, rulesdir/prefer-underscore-method -- Sequential differential experiments use native collections and print evidence. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {runInThisContext} from 'node:vm';
import {collectCompiledCalls} from './validate-footer-ordering.mjs';

const base = 'df1e765feee11ea8983554979da24405a4b39411';
const filename = 'src/pages/AddPersonalBankAccountPage/substeps/LegalNameStep.tsx';
const {values} = parseArgs({options: {app: {type: 'string'}, output: {type: 'string'}}});
assert(values.app, 'Pass --app /path/to/the/autofixed/App/worktree');
assert([24, 26].includes(Number(process.versions.node.split('.')[0])), 'Use native Node 24 or 26');
assert.equal(typeof globalThis.Bun, 'undefined', 'Run with native Node, not a compatibility runtime');
const app = path.resolve(values.app);
const requireApp = createRequire(path.join(app, 'package.json'));
const React = requireApp('react');
const {act, create} = requireApp('react-test-renderer');
const {transformSync} = requireApp('oxc-transform-react');
const esbuild = requireApp('esbuild');
const parse = requireApp('@typescript-eslint/parser').parse;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function sourceAtBase(file) {
    return execFileSync('git', ['show', `${base}:${file}`], {cwd: app, encoding: 'utf8'});
}

function fingerprint(source) {
    return createHash('sha256').update(source).digest('hex');
}

function evaluate(code, imports = {}) {
    const module = {exports: {}};
    const run = runInThisContext(`(function(require, module, exports) {\n${code}\n})`);
    run((id) => {
        if (id === 'react' || id.startsWith('react/')) {
            return requireApp(id);
        }
        assert(Object.hasOwn(imports, id), `Unmocked runtime import: ${id}`);
        return imports[id];
    }, module, module.exports);
    return module.exports;
}

const configSource = sourceAtBase('config/babel/oxcReactCompilerConfig.js');
assert.equal(fs.readFileSync(path.join(app, 'config/babel/oxcReactCompilerConfig.js'), 'utf8'), configSource, 'Same App compiler config');
const config = evaluate(configSource);
const versions = {
    node: process.version,
    oxc: requireApp('oxc-transform-react/package.json').version,
    react: React.version,
    renderer: requireApp('react-test-renderer/package.json').version,
};
assert.equal(versions.oxc, '0.156.0', 'Rebaseline compiler assertions explicitly when upgrading');
assert.equal(versions.react, '19.2.3');
assert.equal(versions.renderer, versions.react);

function compile(source, file, enabled) {
    const result = transformSync(file, source, {
        lang: file.endsWith('.tsx') ? 'tsx' : 'ts',
        reactCompiler: enabled ? {...config(), reportDiagnostics: true} : false,
    });
    assert.equal(result.fatal, false);
    assert.deepEqual(result.errors, [], `${file}: compiler diagnostics`);
    return result.code;
}

const idsFile = 'src/types/form/PersonalBankAccountForm.ts';
const inputIDs = evaluate(esbuild.transformSync(compile(sourceAtBase(idsFile), idsFile, false), {format: 'cjs'}).code).default;
const fields = ['legalFirstName', 'legalLastName'];
assert.deepEqual([inputIDs.BANK_INFO_STEP.FIRST_NAME, inputIDs.BANK_INFO_STEP.LAST_NAME], fields);

function summary(code) {
    return {
        ...collectCompiledCalls(code, parse, 'LegalNameStep'),
        slots: Number((code.match(/const \$ = _c\((\d+)\)/) || [0, 0])[1]),
        predicates: code.split('\n').map(line => line.trim()).filter(line => line.startsWith('if ($[')),
    };
}

function environment() {
    const callbacks = [];
    const submissions = [];
    const lifecycle = [];
    const hooks = [];
    const submitOptions = [];
    const translations = [];
    const callbackIDs = new Map();
    function callback(id) {
        const fn = (...args) => callbacks.push({id, args});
        callbackIDs.set(fn, id);
        return fn;
    }
    const nextA = callback('nextA');
    const nextB = callback('nextB');
    const moveA = callback('moveA');
    const moveB = callback('moveB');
    const translator = locale => (key) => {
        translations.push(`${locale}:${key}`);
        return `${locale}:${key}`;
    };
    const en = translator('en');
    const fr = translator('fr');
    const details = Object.freeze({legalFirstName: 'Ada', legalLastName: 'Lovelace'});
    const initial = {
        details, onNext: nextA, onMove: moveA, isEditing: false, enabledWhenOffline: false, translate: en, locale: 'en',
    };
    const sequence = [];
    let state = initial;
    function step(label, changes, expectedNames) {
        state = {...state, ...changes};
        sequence.push({...state, label, expectedNames});
    }
    step('mount', {}, ['Ada', 'Lovelace']);
    step('stable', {}, ['Ada', 'Lovelace']);
    step('unrelatedProp', {noise: 1}, ['Ada', 'Lovelace']);
    step('equalNamesNewDetails', {details: Object.freeze({...details, birthday: '1815-12-10'})}, ['Ada', 'Lovelace']);
    step('firstNameOnly', {details: Object.freeze({legalFirstName: 'Grace', legalLastName: 'Lovelace'})}, ['Grace', 'Lovelace']);
    step('lastNameOnly', {details: Object.freeze({legalFirstName: 'Grace', legalLastName: 'Hopper'})}, ['Grace', 'Hopper']);
    step('missingFirstName', {details: Object.freeze({legalLastName: 'Hopper'})}, ['', 'Hopper']);
    step('missingLastName', {details: Object.freeze({legalFirstName: 'Grace'})}, ['Grace', '']);
    step('missingDetails', {details: undefined}, ['', '']);
    step('nullNames', {details: Object.freeze({legalFirstName: null, legalLastName: null})}, ['', '']);
    step('emptyNames', {details: Object.freeze({legalFirstName: '', legalLastName: ''})}, ['', '']);
    step('stableEmptyNames', {}, ['', '']);
    step('nextCallbackOnly', {onNext: nextB}, ['', '']);
    step('moveCallbackOnly', {onMove: moveB}, ['', '']);
    step('editingOnly', {isEditing: true}, ['', '']);
    step('offlineOnly', {enabledWhenOffline: true}, ['', '']);
    step('localeOnly', {translate: fr, locale: 'fr'}, ['', '']);
    step('revisitInitial', initial, ['Ada', 'Lovelace']);
    let input;
    let latestSubmit;
    let stepFields;
    const imports = {
        '@components/SubStepForms/FullNameStep': 'FullNameStep',
        '@src/ONYXKEYS': {PRIVATE_PERSONAL_DETAILS: 'privatePersonalDetails', FORMS: {PERSONAL_BANK_ACCOUNT_FORM: 'personalBankAccountForm'}},
        '@src/types/form/PersonalBankAccountForm': inputIDs,
        '@hooks/useLocalize': () => {
            hooks.push('useLocalize');
            return {translate: input.translate};
        },
        '@hooks/useOnyx': function useOnyx(key) {
            hooks.push('useOnyx');
            assert.equal(key, 'privatePersonalDetails');
            React.useEffect(() => {
                lifecycle.push(`subscribe:${key}`);
                return () => lifecycle.push(`unsubscribe:${key}`);
            }, [key]);
            return [input.details];
        },
        '@hooks/usePersonalBankAccountDetailsFormSubmit': function usePersonalBankAccountDetailsFormSubmit({fieldIds, onNext, shouldSaveDraft}) {
            hooks.push('usePersonalBankAccountDetailsFormSubmit');
            assert.deepEqual(fieldIds, fields);
            stepFields ??= fieldIds;
            assert.equal(fieldIds, stepFields, 'Module-level step fields keep their identity');
            const nextID = callbackIDs.get(onNext);
            submitOptions.push({fieldIds: [...fieldIds], nextID, shouldSaveDraft});
            React.useEffect(() => {
                lifecycle.push(`submitSetup:${nextID}:${shouldSaveDraft}`);
                return () => lifecycle.push(`submitCleanup:${nextID}:${shouldSaveDraft}`);
            }, [fieldIds, onNext, shouldSaveDraft, nextID]);
            latestSubmit = React.useCallback((formValues) => {
                submissions.push({
                    formValues, fieldIds: [...fieldIds], nextID, shouldSaveDraft,
                });
                onNext();
            }, [fieldIds, onNext, shouldSaveDraft, nextID]);
            return latestSubmit;
        },
    };
    return {
        imports,
        sequence,
        callbacks,
        submissions,
        lifecycle,
        hooks,
        submitOptions,
        translations,
        callbackIDs,
        setInput(value) { input = value; },
        latestSubmit: () => latestSubmit,
    };
}

async function measure(code, compiled) {
    const env = environment();
    const implementation = evaluate(esbuild.transformSync(code, {format: 'cjs'}).code, env.imports).default;
    assert.equal(implementation.displayName, 'LegalNameStep', 'Evaluate the full module including exports');
    const samples = [];
    let root;
    let previous;
    const expectedCallbacks = [];
    const expectedSubmissions = [];
    const expectedOptions = [];
    const expectedHooks = ['useLocalize', 'useOnyx', 'usePersonalBankAccountDetailsFormSubmit'];
    async function render(input) {
        await act(() => {
            const element = React.createElement(implementation, {
                onNext: input.onNext,
                onMove: input.onMove,
                isEditing: input.isEditing,
                enabledWhenOffline: input.enabledWhenOffline,
                noise: input.noise,
            });
            if (root) {
                root.update(element);
            } else {
                root = create(element);
            }
        });
    }
    try {
        for (const input of env.sequence) {
            env.setInput(input);
            const hookStart = env.hooks.length;
            await render(input);
            assert.deepEqual(env.hooks.slice(hookStart), expectedHooks, `${input.label}: each hook runs once in order`);
            const props = root.root.findByType('FullNameStep').props;
            const output = {
                ...props,
                onNext: env.callbackIDs.get(props.onNext),
                onMove: env.callbackIDs.get(props.onMove),
                onSubmit: 'mockSubmit',
            };
            assert.deepEqual(output, {
                isEditing: input.isEditing,
                onNext: env.callbackIDs.get(input.onNext),
                onMove: env.callbackIDs.get(input.onMove),
                formID: 'personalBankAccountForm',
                formTitle: `${input.locale}:personalInfoStep.whatsYourLegalName`,
                formSubtitle: `${input.locale}:personalInfoStep.legalNameSubtitle`,
                onSubmit: 'mockSubmit',
                stepFields: fields,
                firstNameInputID: fields[0],
                lastNameInputID: fields[1],
                defaultValues: {firstName: input.expectedNames[0], lastName: input.expectedNames[1]},
                enabledWhenOffline: input.enabledWhenOffline,
            }, `${input.label}: complete child prop contract`);
            assert.equal(props.onSubmit, env.latestSubmit(), `${input.label}: current hook handler is forwarded`);
            assert.equal(props.onNext, input.onNext);
            assert.equal(props.onMove, input.onMove);
            const sameDefaultsReference = !!previous && props.defaultValues === previous.props.defaultValues;
            const unchangedNames = !!previous
                && Object.is(input.details && input.details.legalFirstName, previous.input.details && previous.input.details.legalFirstName)
                && Object.is(input.details && input.details.legalLastName, previous.input.details && previous.input.details.legalLastName);
            assert.equal(sameDefaultsReference, compiled && unchangedNames, `${input.label}: default value identity`);
            const formValues = Object.freeze({legalFirstName: `submitted:${input.label}`, legalLastName: 'User input'});
            const options = {fieldIds: fields, nextID: env.callbackIDs.get(input.onNext), shouldSaveDraft: input.isEditing};
            expectedOptions.push(options);
            expectedSubmissions.push({formValues, ...options});
            props.onSubmit(formValues);
            props.onNext('directNext');
            props.onMove('legalName');
            expectedCallbacks.push(
                {id: options.nextID, args: []},
                {id: options.nextID, args: ['directNext']},
                {id: env.callbackIDs.get(input.onMove), args: ['legalName']},
            );
            assert.deepEqual(env.submitOptions, expectedOptions, `${input.label}: submit hook arguments`);
            assert.deepEqual(env.submissions, expectedSubmissions, `${input.label}: submit payload and current closure`);
            assert.equal(env.submissions.at(-1).formValues, formValues, 'Submitted object forwarded unchanged');
            assert.deepEqual(env.callbacks, expectedCallbacks, `${input.label}: callback arguments and current identities`);
            samples.push({
                label: input.label, output, sameDefaultsReference, lifecycle: [...env.lifecycle],
            });
            previous = {props, input};
        }
    } finally {
        if (root) {
            await act(() => root.unmount());
        }
    }
    assert.deepEqual(env.lifecycle, [
        'subscribe:privatePersonalDetails', 'submitSetup:nextA:false',
        'submitCleanup:nextA:false', 'submitSetup:nextB:false',
        'submitCleanup:nextB:false', 'submitSetup:nextB:true',
        'submitCleanup:nextB:true', 'submitSetup:nextA:false',
        'unsubscribe:privatePersonalDetails', 'submitCleanup:nextA:false',
    ], 'Mock effects update for changed callback/editing dependencies and clean up on unmount');
    assert.equal(env.translations.length, compiled ? 6 : 36, 'Translation calls with stable and changed translators');
    return {
        samples,
        callbacks: env.callbacks,
        submissions: env.submissions,
        submitOptions: env.submitOptions,
        lifecycle: env.lifecycle,
        hooks: env.hooks,
        translations: env.translations,
    };
}

const beforeSource = sourceAtBase(filename);
const afterSource = fs.readFileSync(path.join(app, filename), 'utf8');
assert.notEqual(afterSource, beforeSource, 'Use the actual autofixed worktree');
assert.deepEqual(afterSource.split(/\s+/).sort(), beforeSource.split(/\s+/).sort(), 'Autofix only reorders source tokens');
const staticResults = {};
const runtime = {};
for (const [name, source] of Object.entries({before: beforeSource, after: afterSource})) {
    for (const enabled of [false, true]) {
        const variant = `${name}${enabled ? 'Compiled' : 'Source'}`;
        const code = compile(source, filename, enabled);
        staticResults[variant] = summary(code);
        runtime[variant] = await measure(code, enabled);
    }
}
assert.deepEqual([staticResults.beforeCompiled.slots, staticResults.afterCompiled.slots], [21, 19]);
assert.deepEqual([staticResults.beforeCompiled.predicates.length, staticResults.afterCompiled.predicates.length], [6, 5]);
assert.deepEqual(staticResults.beforeCompiled.calls.getDefaultValues, {guarded: 1, unguarded: 0});
assert.deepEqual(staticResults.afterCompiled.calls.getDefaultValues, {guarded: 1, unguarded: 0});
assert(staticResults.beforeCompiled.predicates.some(predicate => predicate.includes('!== getDefaultValues')));
assert(!staticResults.afterCompiled.predicates.some(predicate => predicate.includes('!== getDefaultValues')));
for (const result of Object.values(staticResults)) {
    assert.deepEqual(result.hooks, staticResults.beforeSource.hooks, 'Static hook order across four variants');
}
for (const run of Object.values(runtime)) {
    assert.deepEqual(
        run.samples.map(({label, output, lifecycle}) => ({label, output, lifecycle})),
        runtime.beforeSource.samples.map(({label, output, lifecycle}) => ({label, output, lifecycle})),
        'Four-way values and effect timing',
    );
    for (const key of ['callbacks', 'submissions', 'submitOptions', 'lifecycle', 'hooks']) {
        assert.deepEqual(run[key], runtime.beforeSource[key], `Four-way ${key}`);
    }
}
assert.deepEqual(runtime.afterSource, runtime.beforeSource, 'Compiler-disabled controls preserve the complete observed trace');
assert.deepEqual(runtime.afterCompiled, runtime.beforeCompiled, 'Compiled variants preserve the complete observed trace, including cache reuse');
const report = {
    base,
    filename,
    versions,
    config: config({reportDiagnostics: true}),
    fingerprints: {before: fingerprint(beforeSource), after: fingerprint(afterSource), config: fingerprint(configSource)},
    static: staticResults,
    runtime,
    limits: 'Native Node/React test renderer; inert child and controlled hook mocks. No browser, device UI, real Onyx, form validation, persistence, or latency measurement.',
};
if (values.output) {
    fs.writeFileSync(values.output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
