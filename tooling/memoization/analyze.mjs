/* eslint-disable rulesdir/prefer-underscore-method -- Compiler IR uses native Maps and Sets. */
/* eslint-disable es/no-optional-chaining, es/no-nullish-coalescing-operators -- This offline tool requires Node 24. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const BEFORE_PASS = 'FlattenReactiveLoopsHIR';
const TARGET_PASS = 'FlattenScopesWithHooksOrUseHIR';
const SUPPORTED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const CONSTRUCTION_KINDS = new Set(['ArrayExpression', 'ObjectExpression', 'NewExpression', 'CallExpression', 'MethodCall']);
const CONTINUATION_KINDS = new Set(['CallExpression', 'MethodCall', 'PropertyStore', 'ComputedStore']);

function location(loc) {
    if (!loc || typeof loc !== 'object' || !loc.start || !loc.end) {
        return null;
    }
    const point = ({line, column, index}) => ({line, column, ...(index === undefined ? {} : {index})});
    return {start: point(loc.start), end: point(loc.end)};
}

function locationKey(loc) {
    return loc ? `${loc.start.line}:${loc.start.column}-${loc.end.line}:${loc.end.column}` : 'unknown';
}

function sourceText(source, loc) {
    return Number.isInteger(loc?.start?.index) && Number.isInteger(loc?.end?.index)
        ? source.slice(loc.start.index, loc.end.index)
        : null;
}

// Stop at places and nested functions: neither identifier graphs nor nested bodies belong to this instruction.
function visitPlaces(value, visit, seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value)) {
        return;
    }
    seen.add(value);
    if (value.identifier) {
        visit(value.identifier);
        return;
    }
    for (const [key, child] of Object.entries(value)) {
        if (key === 'func' || key === 'loc') {
            continue;
        }
        visitPlaces(child, visit, seen);
    }
}

function getHook(fn, instruction, source) {
    const {value} = instruction;
    if (value.kind !== 'CallExpression' && value.kind !== 'MethodCall') {
        return null;
    }
    const callee = value.kind === 'MethodCall' ? value.property : value.callee;
    const {type} = callee.identifier;
    if (type.kind !== 'Function') {
        return null;
    }
    const kind = type.shapeId === 'BuiltInUseOperator' ? 'use' : fn.env.getFunctionSignature(type)?.hookKind;
    return kind ? {
        name: sourceText(source, callee.loc) ?? kind, kind, location: location(instruction.loc), instructionId: instruction.id,
    } : null;
}

function snapshot(fn, source, functionNames) {
    const scopes = new Map();
    for (const block of fn.body.blocks.values()) {
        const {terminal} = block;
        if (terminal.kind !== 'scope') {
            continue;
        }
        scopes.set(terminal.scope.id, {
            scopeId: terminal.scope.id,
            blockId: block.id,
            fallthrough: terminal.fallthrough,
            location: location(terminal.scope.loc),
            instructionRange: {...terminal.scope.range},
            values: [],
            hooks: [],
            constructions: [],
            continuations: [],
            bindings: [],
        });
    }
    let active = [];
    const hookResults = new Set();
    for (const block of fn.body.blocks.values()) {
        active = active.filter(scope => scope.fallthrough !== block.id);
        for (const instruction of block.instructions) {
            const hook = getHook(fn, instruction, source);
            const {value} = instruction;
            if (hook || (value.kind === 'LoadLocal' && hookResults.has(value.place.identifier.id))) {
                hookResults.add(instruction.lvalue.identifier.id);
            }
            if (value.kind === 'StoreLocal') {
                const identifier = value.lvalue.place.identifier;
                if (hookResults.has(value.value.identifier.id)) {
                    hookResults.add(identifier.id);
                } else if (identifier.name?.kind === 'named') {
                    scopes.get(identifier.scope?.id)?.bindings.push({name: identifier.name.value, instructionId: instruction.id});
                }
            }
            const referencedScopes = new Set();
            visitPlaces(instruction, (identifier) => {
                const scope = scopes.get(identifier.scope?.id);
                if (!scope) {
                    return;
                }
                referencedScopes.add(scope);
                if (identifier.name?.kind !== 'named' || scope.values.some(scopedValue => scopedValue.declarationId === identifier.declarationId)) {
                    return;
                }
                scope.values.push({name: identifier.name.value, declarationId: identifier.declarationId, location: location(identifier.loc)});
            });
            if (hook) {
                for (const scope of active) {
                    scope.hooks.push(hook);
                }
                continue;
            }
            const ownScope = scopes.get(instruction.lvalue?.identifier.scope?.id);
            if (ownScope && CONSTRUCTION_KINDS.has(instruction.value.kind)) {
                ownScope.constructions.push({instructionId: instruction.id, kind: instruction.value.kind, location: location(instruction.loc)});
            }
            if (CONTINUATION_KINDS.has(instruction.value.kind)) {
                for (const scope of referencedScopes) {
                    scope.continuations.push({instructionId: instruction.id, kind: instruction.value.kind, location: location(instruction.loc)});
                }
            }
        }
        if (block.terminal.kind === 'scope') {
            active.push(scopes.get(block.terminal.scope.id));
        }
    }
    return {
        function: {name: fn.id ?? fn.nameHint ?? functionNames.get(locationKey(fn.loc)) ?? '<anonymous>', location: location(fn.loc)},
        scopes: [...scopes.values()],
    };
}

// Require non-hook construction and subsequent scoped work on opposite sides of an enclosed hook.
// Binding stores and destructuring hook returns alone are not construction continuations.
function hasConstructionCrossing(scope) {
    return scope.hooks.some(hook => scope.bindings.some(binding => binding.instructionId < hook.instructionId)
        && scope.constructions.some(construction => construction.instructionId < hook.instructionId)
        && scope.continuations.some(continuation => continuation.instructionId > hook.instructionId));
}

function parserPlugins(filename) {
    const ext = path.extname(filename);
    return [...(ext === '.ts' || ext === '.tsx' ? ['typescript'] : []), ...(ext === '.ts' ? [] : ['jsx'])];
}

function collectFunctionNames(ast, babel) {
    const names = new Map();
    babel.traverse(ast, {
        Function(functionPath) {
            let name = functionPath.node.id?.name;
            let parent = functionPath.parentPath;
            while (!name && parent && !parent.isFunction() && !parent.isStatement()) {
                if (parent.isVariableDeclarator() && parent.node.id.type === 'Identifier') {
                    name = parent.node.id.name;
                }
                parent = parent.parentPath;
            }
            if (name) {
                names.set(locationKey(functionPath.node.loc), name);
            }
        },
    });
    return names;
}

function analyzeBabel(source, filename, engines) {
    const findings = [];
    const diagnostics = [];
    const functions = [];
    const pending = new WeakMap();
    const passed = new Set();
    const succeeded = new Set();
    let ignoredHookPrunedScopes = 0;
    let failure = null;
    try {
        const options = {
            filename, babelrc: false, configFile: false, parserOpts: {plugins: parserPlugins(filename)},
        };
        const ast = engines.babel.parseSync(source, options);
        const functionNames = collectFunctionNames(ast, engines.babel);
        engines.babel.transformFromAstSync(ast, source, {
            ...options,
            plugins: [[engines.babelCompiler, {
                ...engines.config(),
                logger: {
                    logEvent(file, event) {
                        if (event.kind === 'CompileSuccess') {
                            succeeded.add(locationKey(event.fnLoc));
                            functions.push({status: 'compiled', location: location(event.fnLoc), name: event.fnName ?? functionNames.get(locationKey(event.fnLoc)) ?? null});
                            return;
                        }
                        const detail = event.detail;
                        diagnostics.push({kind: event.kind, reason: detail?.reason ?? event.reason ?? event.data ?? null, location: location(detail?.loc ?? event.fnLoc)});
                    },
                    debugLogIRs(event) {
                        if (event.kind !== 'hir') {
                            return;
                        }
                        if (event.name === BEFORE_PASS) {
                            pending.set(event.value, snapshot(event.value, source, functionNames));
                            return;
                        }
                        if (event.name !== TARGET_PASS) {
                            return;
                        }
                        const before = pending.get(event.value);
                        if (!before) {
                            throw new Error('Missing pre-pass HIR snapshot');
                        }
                        passed.add(locationKey(before.function.location));
                        for (const scope of before.scopes) {
                            const after = event.value.body.blocks.get(scope.blockId)?.terminal;
                            if (after?.kind !== 'pruned-scope' && after?.kind !== 'label') {
                                continue;
                            }
                            if (scope.hooks.length === 0) {
                                throw new Error('Hook-flattened scope has no identified enclosed hook');
                            }
                            if (!hasConstructionCrossing(scope)) {
                                ignoredHookPrunedScopes += 1;
                                continue;
                            }
                            const {fallthrough, ...summary} = scope;
                            findings.push({
                                kind: 'babel-reference-hook-crossing', pass: TARGET_PASS, function: before.function, ...summary, afterKind: after.kind,
                            });
                        }
                    },
                },
            }]],
        });
    } catch (error) {
        failure = error.message;
    }
    for (const finding of findings) {
        finding.functionCompilation = succeeded.has(locationKey(finding.function.location)) ? 'compiled' : 'not-confirmed';
    }
    let status = succeeded.size ? 'compiled' : 'skipped-or-ineligible';
    if (diagnostics.some(event => event.kind === 'CompileError' || event.kind === 'CompileDiagnostic')) {
        status = 'diagnostics';
    }
    if (failure || diagnostics.some(event => event.kind === 'PipelineError')) {
        status = 'failed';
    }
    return {
        status,
        failure,
        diagnostics,
        functions,
        functionsReachingTargetPass: passed.size,
        ignoredHookPrunedScopes,
        findings: findings.filter(finding => finding.functionCompilation === 'compiled'),
        unconfirmedScopeChanges: findings.filter(finding => finding.functionCompilation !== 'compiled'),
    };
}

function runtimeImports(code, filename, babel) {
    const ast = babel.parseSync(code, {
        filename, babelrc: false, configFile: false, parserOpts: {plugins: parserPlugins(filename)},
    });
    return ast.program.body.filter(node => node.type === 'ImportDeclaration' && node.source.value === 'react/compiler-runtime').length;
}

function analyzeOxc(source, filename, engines) {
    try {
        const ext = path.extname(filename);
        const lang = {'.ts': 'ts', '.tsx': 'tsx'}[ext] ?? 'jsx';
        const result = engines.oxc.transformSync(filename, source, {lang, reactCompiler: {...engines.config(), reportDiagnostics: true}});
        const diagnostics = (result.errors ?? []).map(error => ({message: error.message, severity: error.severity, labels: error.labels ?? []}));
        if (result.fatal) {
            return {
                status: 'failed', fatal: true, diagnostics, failure: null,
            };
        }
        const plain = engines.oxc.transformSync(filename, source, {lang, reactCompiler: false});
        if (plain.fatal || plain.errors?.length) {
            throw new Error('OXC control transform failed');
        }
        const outputChanged = result.code !== plain.code;
        let status = outputChanged ? 'compiled-output' : 'unchanged';
        if (diagnostics.length) {
            status = 'diagnostics';
        }
        return {
            status,
            fatal: false,
            diagnostics,
            failure: null,
            outputChanged,
            memoRuntimeImportAdded: runtimeImports(result.code, filename, engines.babel) > runtimeImports(plain.code, filename, engines.babel),
        };
    } catch (error) {
        return {status: 'failed', failure: error.message, diagnostics: []};
    }
}

function loadEngines(appDirectory) {
    const app = path.resolve(appDirectory);
    const requireApp = createRequire(path.join(app, 'package.json'));
    const versions = {
        node: process.versions.node,
        babel: requireApp('@babel/core/package.json').version,
        babelCompiler: requireApp('babel-plugin-react-compiler/package.json').version,
        oxc: requireApp('oxc-transform-react/package.json').version,
    };
    if (versions.babelCompiler !== '1.0.0') {
        throw new Error(`Expected Babel reference compiler 1.0.0; found ${versions.babelCompiler}. The HIR adapter is version-specific.`);
    }
    return {
        versions,
        configPath: path.join(app, 'config/babel/oxcReactCompilerConfig.js'),
        babel: requireApp('@babel/core'),
        babelCompiler: requireApp('babel-plugin-react-compiler'),
        oxc: requireApp('oxc-transform-react'),
        config: requireApp(path.join(app, 'config/babel/oxcReactCompilerConfig.js')),
    };
}

function analyzeSource(source, filename, engines) {
    if (!SUPPORTED_EXTENSIONS.has(path.extname(filename))) {
        throw new Error(`Unsupported input extension: ${filename}`);
    }
    return {filename, babel: analyzeBabel(source, filename, engines), oxc: analyzeOxc(source, filename, engines)};
}

function analyzeFiles(filenames, engines) {
    return [...new Set(filenames.map(filename => path.resolve(filename)))].sort().map((filename) => {
        try {
            return analyzeSource(fs.readFileSync(filename, 'utf8'), filename, engines);
        } catch (error) {
            return {filename, failure: error.message};
        }
    });
}

export {analyzeFiles, analyzeSource, loadEngines};
