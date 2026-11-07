/* eslint-disable rulesdir/prefer-underscore-method -- This standalone analyzer uses native collection methods. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const base = 'd0dc7d0ef16ada442fc402301f25ed57427b33b9';
const filename = 'src/components/Search/SearchSelectionFooter.tsx';

function children(node) {
    return Object.entries(node).flatMap(([key, value]) => {
        if (['loc', 'start', 'end', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) {
            return [];
        }
        return (Array.isArray(value) ? value : [value]).filter(child => child && typeof child === 'object' && typeof child.type === 'string');
    });
}

function callName(node) {
    if (node.type === 'Identifier') {
        return /^t\d+$/.test(node.name) ? 't' : node.name;
    }
    if (['MemberExpression', 'OptionalMemberExpression'].includes(node.type) && !node.computed) {
        const object = callName(node.object);
        return object ? `${object}.${node.property.name}` : undefined;
    }
    return undefined;
}

function collectCompiledCalls(code, parse, functionName) {
    const ast = parse(code, {sourceType: 'module'});
    const component = (ast.program || ast).body.map(node => (node.type === 'ExportDefaultDeclaration' ? node.declaration : node))
        .find(node => node.type === 'FunctionDeclaration' && node.id.name === functionName);
    assert.ok(component, `Compiled function not found: ${functionName}`);
    const calls = {};
    const hooks = [];
    function readsCache(node) {
        return (node.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === '$') || children(node).some(readsCache);
    }
    function visit(node, guarded = false) {
        if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod'].includes(node.type)) {
            return;
        }
        if (node.type === 'IfStatement' && readsCache(node.test)) {
            visit(node.test, guarded);
            visit(node.consequent, true);
            if (node.alternate) {
                visit(node.alternate, guarded);
            }
            return;
        }
        if (['CallExpression', 'OptionalCallExpression', 'NewExpression'].includes(node.type)) {
            const name = callName(node.callee);
            if (name && /^use[A-Z0-9]/.test(name.split('.').at(-1))) {
                hooks.push(name);
            } else if (name && name !== '_c' && name !== 'Symbol.for' && !name.startsWith('_jsx')) {
                if (!calls[name]) {
                    calls[name] = {guarded: 0, unguarded: 0};
                }
                calls[name][guarded ? 'guarded' : 'unguarded'] += 1;
            }
        }
        for (const child of children(node)) {
            visit(child, guarded);
        }
    }
    visit(component.body);
    return {calls, hooks};
}

function validateFooterOrdering({app, requireApp, compile}) {
    const parse = requireApp('@typescript-eslint/parser').parse;
    const source = execFileSync('git', ['show', `${base}:${filename}`], {cwd: app, encoding: 'utf8'});
    function move(sourceText, startMarker, endMarker, beforeMarker) {
        const start = sourceText.indexOf(startMarker);
        const end = sourceText.indexOf(endMarker, start);
        assert.ok(start >= 0 && end > start, `Missing move markers: ${startMarker}`);
        const block = sourceText.slice(start, end);
        const remaining = sourceText.slice(0, start) + sourceText.slice(end);
        const destination = remaining.indexOf(beforeMarker);
        assert.ok(destination >= 0, `Missing destination: ${beforeMarker}`);
        return remaining.slice(0, destination) + block + remaining.slice(destination);
    }
    function orderSelection(sourceText) {
        const afterRef = move(sourceText, '    const footerSelection =', '    // Onyx delivers an optimistic source stamp', '    const isCurrentFooterState =');
        return move(afterRef, '    const footerSelection =', '    // The Auth command merges converted figures here', '    const convertedTransactions =');
    }
    const totalsBeforeEffects = move(source, '    let footerData;\n', '    if (!shouldShowFooter) {', '    // Fetch converted figures whenever');
    const selectionAfterSubscriptions = orderSelection(source);
    const combined = orderSelection(totalsBeforeEffects);
    const baseline = collectCompiledCalls(compile(source, filename), parse, 'SearchSelectionFooter');
    const variants = {};
    for (const [name, candidate] of Object.entries({totalsBeforeEffects, selectionAfterSubscriptions, combined})) {
        assert.deepEqual(candidate.split(/\s+/).sort(), source.split(/\s+/).sort(), `${name}: must only reorder source text`);
        const analysis = collectCompiledCalls(compile(candidate, filename), parse, 'SearchSelectionFooter');
        assert.deepEqual(analysis.hooks, baseline.hooks, `${name}: hook sequence changed`);
        const delta = Object.fromEntries(Object.keys({...baseline.calls, ...analysis.calls}).sort().flatMap((callee) => {
            const before = baseline.calls[callee] || {guarded: 0, unguarded: 0};
            const after = analysis.calls[callee] || {guarded: 0, unguarded: 0};
            return before.guarded === after.guarded && before.unguarded === after.unguarded ? [] : [[callee, {before, after}]];
        }));
        const reducerCalls = Object.fromEntries(Object.keys({...baseline.calls, ...analysis.calls}).filter(callee => callee.endsWith('.reduce'))
            .map(callee => [callee, {before: baseline.calls[callee], after: analysis.calls[callee]}]));
        variants[name] = {hookOrderPreserved: true, callGuardChanges: delta, reducerCalls};
    }
    assert.ok(Object.keys(variants.combined.callGuardChanges).length > 0, 'Combined ordering should change call guards');
    return {
        base,
        filename,
        variants,
        runtimeValidated: false,
    };
}

export {collectCompiledCalls, validateFooterOrdering};
