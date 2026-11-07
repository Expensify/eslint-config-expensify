/* eslint-disable rulesdir/prefer-underscore-method -- Offline AST analysis uses native collections. */
/* eslint-disable es/no-optional-chaining -- This offline tool requires Node 24. */
/* eslint-disable no-console -- The CLI prints its output path and failures. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import parser from '@typescript-eslint/parser';
import {loadEngines} from './analyze.mjs';

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const LIMITATIONS = [
    'Only native OXC 0.156.0 with the current App shared compiler config and reportDiagnostics:true is used on both revisions.',
    'Exact output equality is byte equality, including comments. It describes compiler output, not runtime equivalence or performance.',
    'Call counts, cache slots, guard dependencies and root-dependency widening are syntactic heuristics, not proof of non-regression or equivalent cache scopes.',
    'Guards recognize cache-slot comparisons in if consequents only. Dynamic calls, alias/dataflow resolution, bundler preprocessing and build exclusions are not modeled.',
    'Hook checks compare direct calls in each named function, skipping nested bodies. Imported hook aliases and React namespace calls are recognized; arbitrary object methods are not.',
    'Source hook signatures include argument tokens; emitted hooks compare names only because the compiler rewrites arguments. Neither establishes runtime execution order across branches.',
    'Function identity uses lexical parent/name/occurrence, not compiler provenance. Duplicate names, anonymous parents and compiler-generated functions can make matching uncertain.',
    'No finding does not prove preserved caching. Inspect emitted artifacts for changed functions, especially dependency or guard changes.',
];

function children(node) {
    return Object.entries(node).filter(([key]) => !['parent', 'loc', 'range', 'tokens', 'comments'].includes(key))
        .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).filter(child => child && typeof child.type === 'string').map(child => ({key, child})));
}

function walk(node, visitor, skipFunctions = false) {
    if (!node || (skipFunctions && FUNCTION_TYPES.has(node.type))) {
        return;
    }
    visitor(node);
    for (const {child} of children(node)) {
        walk(child, visitor, skipFunctions);
    }
}

function expressionName(node) {
    if (node?.type === 'Identifier') {
        return node.name;
    }
    if (node?.type === 'MemberExpression' && !node.computed) {
        const object = expressionName(node.object);
        return object && node.property.type === 'Identifier' ? `${object}.${node.property.name}` : null;
    }
    return null;
}

function functionName(node, parent) {
    if (node.id?.name) {
        return node.id.name;
    }
    if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        return parent.id.name;
    }
    if (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(parent?.type) && !parent.computed) {
        return parent.key.name || String(parent.key.value);
    }
    return null;
}

function hash(text) {
    return createHash('sha256').update(text).digest('hex');
}

function inspectCode(code, filename) {
    const ast = parser.parse(code, {
        loc: true, range: true, tokens: true, jsx: path.extname(filename) !== '.ts',
    });
    const cacheImports = new Set();
    const hookAliases = new Map();
    const reactNamespaces = new Set();
    for (const statement of ast.body) {
        if (statement.type !== 'ImportDeclaration') {
            continue;
        }
        for (const specifier of statement.specifiers) {
            if (statement.source.value === 'react/compiler-runtime' && specifier.imported?.name === 'c') {
                cacheImports.add(specifier.local.name);
            }
            const imported = specifier.imported?.name;
            if (imported && /^(?:use$|use[A-Z0-9])/.test(imported)) {
                hookAliases.set(specifier.local.name, imported);
            }
            if (statement.source.value === 'react' && ['ImportDefaultSpecifier', 'ImportNamespaceSpecifier'].includes(specifier.type)) {
                reactNamespaces.add(specifier.local.name);
            }
        }
    }
    const signature = node => JSON.stringify(ast.tokens.filter(token => token.range[0] >= node.range[0] && token.range[1] <= node.range[1]).map(token => token.value));
    const text = node => code.slice(...node.range);
    const functions = [];
    const occurrences = new Map();

    function inspectFunction(node, id, name) {
        const caches = new Map();
        walk(node.body, (part) => {
            if (part.type !== 'VariableDeclarator' || part.id.type !== 'Identifier' || part.init?.type !== 'CallExpression'
                || !cacheImports.has(expressionName(part.init.callee)) || !Number.isInteger(part.init.arguments[0]?.value)) {
                return;
            }
            caches.set(part.id.name, part.init.arguments[0].value);
        }, true);
        const cacheSlot = part => part?.type === 'MemberExpression' && caches.has(part.object.name) && part.computed && Number.isInteger(part.property.value);
        const guards = [];
        const calls = new Map();
        const hooks = [];
        function visit(part, activeGuards = []) {
            if (!part || FUNCTION_TYPES.has(part.type)) {
                return;
            }
            if (part.type === 'IfStatement') {
                const dependencies = [];
                const slots = [];
                walk(part.test, (test) => {
                    if (test.type !== 'BinaryExpression' || !['!==', '===', '!=', '=='].includes(test.operator)) {
                        return;
                    }
                    const rightSlot = cacheSlot(test.right) ? test.right : null;
                    const slot = cacheSlot(test.left) ? test.left : rightSlot;
                    if (!slot) {
                        return;
                    }
                    const other = slot === test.left ? test.right : test.left;
                    const sentinel = other.type === 'CallExpression' && expressionName(other.callee) === 'Symbol.for'
                        && other.arguments[0]?.value === 'react.memo_cache_sentinel';
                    if ((sentinel && ['===', '=='].includes(test.operator)) || (!sentinel && ['!==', '!='].includes(test.operator))) {
                        slots.push(text(slot));
                        if (!sentinel) {
                            dependencies.push(text(other));
                        }
                    }
                }, true);
                const guard = slots.length ? {test: text(part.test), slots, dependencies: [...new Set(dependencies)].sort()} : null;
                if (guard) {
                    guards.push(guard);
                }
                visit(part.test, activeGuards);
                visit(part.consequent, guard ? [...activeGuards, guard] : activeGuards);
                visit(part.alternate, activeGuards);
                return;
            }
            if (part.type === 'CallExpression') {
                const call = expressionName(part.callee);
                if (call && !cacheImports.has(call) && !(call === 'Symbol.for' && part.arguments[0]?.value === 'react.memo_cache_sentinel')) {
                    const counts = calls.get(call) || {
                        name: call, guarded: 0, unguarded: 0, guardDependencies: [],
                    };
                    counts[activeGuards.length ? 'guarded' : 'unguarded']++;
                    if (activeGuards.length) {
                        counts.guardDependencies.push([...new Set(activeGuards.flatMap(guard => guard.dependencies))].sort());
                    }
                    calls.set(call, counts);
                    const directHook = part.callee.type === 'Identifier' && (hookAliases.get(call) || (/^(?:use$|use[A-Z0-9])/.test(call) ? call : null));
                    const namespaceHook = part.callee.type === 'MemberExpression' && reactNamespaces.has(part.callee.object.name)
                        && /^(?:use$|use[A-Z0-9])/.test(part.callee.property.name) ? part.callee.property.name : null;
                    if (directHook || namespaceHook) {
                        hooks.push({
                            name: directHook || namespaceHook, signature: signature(part), line: part.loc.start.line, offset: part.range[0],
                        });
                    }
                }
            }
            for (const {child} of children(part)) {
                visit(child, activeGuards);
            }
        }
        visit(node.body);
        functions.push({
            id,
            name,
            line: node.loc.start.line,
            cacheAllocations: caches.size,
            cacheSlots: [...caches.values()].reduce((sum, count) => sum + count, 0),
            calls: [...calls.values()].sort((a, b) => a.name.localeCompare(b.name)),
            guards,
            hooks: hooks.sort((a, b) => a.offset - b.offset).map(({offset, ...hook}) => hook),
        });
    }

    function findFunctions(node, parent = null, owner = '<module>') {
        let nextOwner = owner;
        if (FUNCTION_TYPES.has(node.type)) {
            const name = functionName(node, parent);
            const prefix = `${owner}/${name || '<anonymous>'}`;
            const occurrence = (occurrences.get(prefix) || 0) + 1;
            occurrences.set(prefix, occurrence);
            nextOwner = `${prefix}#${occurrence}`;
            if (name) {
                inspectFunction(node, nextOwner, name);
            }
        }
        for (const {child} of children(node)) {
            findFunctions(child, node, nextOwner);
        }
    }
    findFunctions(ast);
    const allocations = [];
    walk(ast, (node) => {
        if (node.type !== 'CallExpression' || !cacheImports.has(expressionName(node.callee)) || !Number.isInteger(node.arguments[0]?.value)) {
            return;
        }
        allocations.push(node.arguments[0].value);
    });
    return {
        runtimeImports: cacheImports.size,
        cacheAllocations: allocations.length,
        cacheSlots: allocations.reduce((sum, count) => sum + count, 0),
        functions,
    };
}

function compileSource(source, filename, engines) {
    const result = {
        sourceHash: hash(source), diagnostics: [], source: null, emitted: null, code: null, status: 'failed',
    };
    try {
        const extension = path.extname(filename);
        const lang = {
            '.ts': 'ts', '.tsx': 'tsx', '.js': 'jsx', '.jsx': 'jsx',
        }[extension];
        const transformed = engines.oxc.transformSync(filename, source, {lang, reactCompiler: {...engines.config(), reportDiagnostics: true}});
        result.diagnostics = (transformed.errors || []).map(error => ({message: error.message, severity: error.severity, labels: error.labels || []}));
        result.source = inspectCode(source, filename);
        if (transformed.fatal || typeof transformed.code !== 'string') {
            result.failure = 'Native OXC did not emit code';
            return result;
        }
        result.code = transformed.code;
        result.emittedHash = hash(result.code);
        result.emitted = inspectCode(result.code, filename);
        result.compiledMarkers = {
            runtimeImports: result.emitted.runtimeImports,
            cacheAllocations: result.emitted.cacheAllocations,
            addedRuntimeImport: result.emitted.runtimeImports > result.source.runtimeImports,
        };
        const markerStatus = result.emitted.cacheAllocations ? 'cached-output' : 'no-cache-marker';
        result.status = result.diagnostics.length ? 'diagnostics' : markerStatus;
    } catch (error) {
        result.failure = error.message;
    }
    return result;
}

function compareFunctions(before, after, kind) {
    const changes = [];
    const warnings = [];
    const oldFunctions = new Map((before?.functions || []).map(fn => [fn.id, fn]));
    const newFunctions = new Map((after?.functions || []).map(fn => [fn.id, fn]));
    for (const id of new Set([...oldFunctions.keys(), ...newFunctions.keys()])) {
        const oldFunction = oldFunctions.get(id);
        const newFunction = newFunctions.get(id);
        if (!oldFunction || !newFunction) {
            changes.push({id, status: oldFunction ? 'removed-or-unmatched' : 'added-or-unmatched'});
            warnings.push({kind: `${kind}-function-unmatched`, function: id});
            continue;
        }
        const hookSequenceEqual = JSON.stringify(oldFunction.hooks.map(hook => (kind === 'source' ? hook.signature : hook.name)))
            === JSON.stringify(newFunction.hooks.map(hook => (kind === 'source' ? hook.signature : hook.name)));
        const guardDependenciesEqual = JSON.stringify(oldFunction.guards.map(guard => guard.dependencies).sort())
            === JSON.stringify(newFunction.guards.map(guard => guard.dependencies).sort());
        const change = {
            id,
            status: 'matched',
            hookSequenceEqual,
            cacheSlotsDelta: newFunction.cacheSlots - oldFunction.cacheSlots,
            guardCountDelta: newFunction.guards.length - oldFunction.guards.length,
            guardDependenciesEqual,
            callChanges: [],
        };
        changes.push(change);
        if (!hookSequenceEqual) {
            warnings.push({kind: `${kind}-hook-sequence-changed`, function: id});
        }
        if (kind === 'source') {
            continue;
        }
        if (oldFunction.cacheAllocations && !newFunction.cacheAllocations) {
            warnings.push({kind: 'missing-cache', function: id});
        }
        if (change.guardCountDelta < 0) {
            warnings.push({kind: 'fewer-cache-guards', function: id});
        }
        if (!guardDependenciesEqual) {
            warnings.push({kind: 'cache-guard-dependencies-changed', function: id});
        }
        const oldDependencies = new Set(oldFunction.guards.flatMap(guard => guard.dependencies));
        const newDependencies = new Set(newFunction.guards.flatMap(guard => guard.dependencies));
        for (const dependency of oldDependencies) {
            const root = /^([A-Za-z_$][\w$]*)[.[]/.exec(dependency)?.[1];
            if (root && !oldDependencies.has(root) && newDependencies.has(root) && !newDependencies.has(dependency)) {
                warnings.push({
                    kind: 'possible-root-dependency-widening', function: id, before: dependency, after: root,
                });
            }
        }
        const oldCalls = new Map(oldFunction.calls.map(call => [call.name, call]));
        const newCalls = new Map(newFunction.calls.map(call => [call.name, call]));
        for (const name of new Set([...oldCalls.keys(), ...newCalls.keys()])) {
            const oldCall = oldCalls.get(name) || {guarded: 0, unguarded: 0, guardDependencies: []};
            const newCall = newCalls.get(name) || {guarded: 0, unguarded: 0, guardDependencies: []};
            const callChange = {
                name,
                guardedDelta: newCall.guarded - oldCall.guarded,
                unguardedDelta: newCall.unguarded - oldCall.unguarded,
                guardDependenciesEqual: JSON.stringify(oldCall.guardDependencies) === JSON.stringify(newCall.guardDependencies),
            };
            if (callChange.guardedDelta || callChange.unguardedDelta || !callChange.guardDependenciesEqual) {
                change.callChanges.push(callChange);
            }
            if (callChange.unguardedDelta > 0) {
                warnings.push({
                    kind: 'added-unguarded-call', function: id, call: name, count: callChange.unguardedDelta,
                });
            }
            if (callChange.guardedDelta < 0) {
                warnings.push({
                    kind: 'fewer-guarded-calls', function: id, call: name, count: -callChange.guardedDelta,
                });
            }
        }
    }
    return {changes, warnings};
}

function compareSources(beforeSource, afterSource, filename, engines) {
    const before = compileSource(beforeSource, filename, engines);
    const after = compileSource(afterSource, filename, engines);
    const source = compareFunctions(before.source, after.source, 'source');
    const emitted = compareFunctions(before.emitted, after.emitted, 'emitted');
    const warnings = [...source.warnings, ...emitted.warnings];
    for (const [side, snapshot] of Object.entries({before, after})) {
        if (snapshot.status === 'failed' || snapshot.diagnostics.length) {
            warnings.push({kind: snapshot.status === 'failed' ? 'analysis-failed' : 'compiler-diagnostics', side});
        }
    }
    return {
        filename,
        before,
        after,
        exactEmittedOutputEqual: before.code !== null && after.code !== null ? before.code === after.code : null,
        sourceHookSequencesEqual: before.source && after.source ? source.changes.every(change => change.status === 'matched' && change.hookSequenceEqual) : null,
        sourceFunctionChanges: source.changes,
        emittedFunctionChanges: emitted.changes,
        warnings,
    };
}

function git(app, args) {
    return execFileSync('git', ['-C', app, ...args], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
}

function assertOutsideApp(app, destination) {
    let existing = path.resolve(destination);
    while (!fs.existsSync(existing)) {
        existing = path.dirname(existing);
    }
    const resolved = path.resolve(fs.realpathSync(existing), path.relative(existing, path.resolve(destination)));
    const relative = path.relative(fs.realpathSync(app), resolved);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
        throw new Error('Output and artifacts must be outside the App worktree to preserve inputs');
    }
}

function compareWorktree({app, base, artifacts}, engines = loadEngines(app)) {
    if (engines.versions.oxc !== '0.156.0') {
        throw new Error(`Expected native OXC 0.156.0, found ${engines.versions.oxc}`);
    }
    const root = fs.realpathSync(app);
    const baseSHA = git(root, ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim();
    if (artifacts) {
        assertOutsideApp(root, artifacts);
    }
    const filenames = git(root, ['diff', '--name-only', '-z', '--no-renames', '--diff-filter=M', baseSHA, '--'])
        .split('\0').filter(filename => EXTENSIONS.has(path.extname(filename))).sort();
    const files = filenames.map((filename) => {
        const beforeSource = git(root, ['show', `${baseSHA}:${filename}`]);
        const afterSource = fs.readFileSync(path.join(root, filename), 'utf8');
        const comparison = compareSources(beforeSource, afterSource, filename, engines);
        if (artifacts) {
            comparison.artifacts = {};
            for (const [side, source] of Object.entries({before: beforeSource, after: afterSource})) {
                const destination = path.resolve(artifacts, side, filename);
                assertOutsideApp(root, `${destination}.source.txt`);
                assertOutsideApp(root, `${destination}.compiled.js`);
                fs.mkdirSync(path.dirname(destination), {recursive: true});
                fs.writeFileSync(`${destination}.source.txt`, source);
                if (comparison[side].code !== null) {
                    fs.writeFileSync(`${destination}.compiled.js`, comparison[side].code);
                }
                comparison.artifacts[side] = {source: `${destination}.source.txt`, emitted: comparison[side].code === null ? null : `${destination}.compiled.js`};
            }
        }
        delete comparison.before.code;
        delete comparison.after.code;
        return comparison;
    });
    return {
        schemaVersion: 1,
        app: root,
        base: baseSHA,
        versions: engines.versions,
        configPath: engines.configPath,
        compilerOptions: {...engines.config(), reportDiagnostics: true},
        limitations: LIMITATIONS,
        selection: 'git diff BASE --diff-filter=M --no-renames; tracked .ts/.tsx/.js/.jsx files including staged and unstaged changes',
        summary: {
            files: files.length,
            exactEmittedOutputEqual: files.filter(file => file.exactEmittedOutputEqual === true).length,
            changedEmittedOutput: files.filter(file => file.exactEmittedOutputEqual === false).length,
            analysisFailed: files.filter(file => file.before.status === 'failed' || file.after.status === 'failed').length,
            sourceHookSequenceChanges: files.filter(file => file.sourceHookSequencesEqual === false).length,
            filesWithWarnings: files.filter(file => file.warnings.length).length,
        },
        files,
    };
}

function main() {
    const {values} = parseArgs({
        options: {
            app: {type: 'string'}, base: {type: 'string'}, output: {type: 'string'}, artifacts: {type: 'string'},
        },
    });
    if (!values.app || !values.base || !values.output) {
        throw new Error('Usage: node tooling/memoization/compare-ordering.mjs --app WORKTREE --base SHA --output JSON [--artifacts DIRECTORY]');
    }
    assertOutsideApp(values.app, values.output);
    const report = compareWorktree(values);
    fs.mkdirSync(path.dirname(path.resolve(values.output)), {recursive: true});
    fs.writeFileSync(values.output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({output: path.resolve(values.output), ...report.summary}));
    if (report.summary.analysisFailed || report.summary.sourceHookSequenceChanges || report.files.some(file => file.after.diagnostics.length)) {
        process.exitCode = 1;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

export {compareSources, compareWorktree, inspectCode};
