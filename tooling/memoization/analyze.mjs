/* eslint-disable rulesdir/prefer-underscore-method -- Offline AST analysis uses native collection methods. */
/* eslint-disable es/no-optional-chaining -- This offline tool requires Node 24. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import parser from '@typescript-eslint/parser';

const SUPPORTED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const WRAPPERS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'ChainExpression']);
const MUTATORS = new Set(['push', 'unshift', 'splice', 'sort', 'reverse', 'add', 'set']);

function unwrap(node) {
    let value = node;
    while (value && WRAPPERS.has(value.type)) {
        value = value.expression;
    }
    return value;
}

function location(node) {
    return {line: node.loc.start.line, column: node.loc.start.column};
}

function visit(node, visitor, insideFunction = false) {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') {
        return;
    }
    if (insideFunction && /Function|ArrowFunctionExpression/.test(node.type)) {
        return;
    }
    visitor(node);
    for (const [key, value] of Object.entries(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range' || key === 'tokens') {
            continue;
        }
        if (Array.isArray(value)) {
            for (const child of value) {
                visit(child, visitor, insideFunction);
            }
        } else {
            visit(value, visitor, insideFunction);
        }
    }
}

function callName(node) {
    const callee = unwrap(node?.callee);
    if (callee?.type === 'Identifier') {
        return callee.name;
    }
    if (callee?.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
        return callee.property.name;
    }
    return null;
}

function hookIn(statement, importedHooks) {
    const init = unwrap(statement.type === 'VariableDeclaration' ? statement.declarations[0]?.init : statement.expression);
    if (init?.type !== 'CallExpression') {
        return null;
    }
    const name = callName(init);
    const callee = unwrap(init.callee);
    if (callee.type !== 'Identifier' || !importedHooks.has(callee.name)) {
        return null;
    }
    return name === 'use' || /^use[A-Z0-9]/.test(name || '') ? {name, location: location(init)} : null;
}

function construction(statement, importedHooks) {
    if (statement.type !== 'VariableDeclaration' || statement.declarations.length !== 1) {
        return null;
    }
    const {id, init} = statement.declarations[0];
    const value = unwrap(init);
    if (id.type !== 'Identifier' || !value || !['ArrayExpression', 'ObjectExpression', 'CallExpression', 'NewExpression'].includes(value.type)
        || (value.type === 'CallExpression' && hookIn(statement, importedHooks))) {
        return null;
    }
    return {
        name: id.name, kind: value.type, location: location(statement), range: statement.range,
    };
}

function continuation(statement, name) {
    let found = null;
    visit(statement, (node) => {
        if (found || node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression'
            || node.callee.object.type !== 'Identifier' || node.callee.object.name !== name || node.callee.computed) {
            return;
        }
        if (MUTATORS.has(node.callee.property.name) || node.callee.property.name === 'find' || node.callee.property.name === 'filter') {
            found = {operation: node.callee.property.name, location: location(node)};
        }
    }, true);
    return found;
}

function sourceCandidates(ast) {
    const candidates = [];
    const importedHooks = new Set();
    for (const statement of ast.body) {
        if (statement.type !== 'ImportDeclaration') {
            continue;
        }
        const moduleName = statement.source.value;
        for (const specifier of statement.specifiers) {
            if ((moduleName === 'react' || /(?:^|\/)use[A-Z0-9]/.test(moduleName))
                && (specifier.local.name === 'use' || /^use[A-Z0-9]/.test(specifier.local.name))) {
                importedHooks.add(specifier.local.name);
            }
        }
    }
    visit(ast, (node) => {
        if (!['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)
            || !node.id || node.id.type !== 'Identifier' || node.body.type !== 'BlockStatement') {
            return;
        }
        const statements = node.body.body;
        for (let index = 0; index < statements.length; index++) {
            const value = construction(statements[index], importedHooks);
            if (!value) {
                continue;
            }
            for (let hookIndex = index + 1; hookIndex < statements.length; hookIndex++) {
                const hook = hookIn(statements[hookIndex], importedHooks);
                if (!hook) {
                    continue;
                }
                for (let lastIndex = hookIndex + 1; lastIndex < statements.length; lastIndex++) {
                    const work = continuation(statements[lastIndex], value.name);
                    if (work) {
                        candidates.push({
                            function: node.id.name, value, hook, continuation: work,
                        });
                        break;
                    }
                }
                break;
            }
        }
    });
    return candidates;
}

function cacheGuard(node) {
    let found = false;
    visit(node.test, (part) => {
        if (part.type !== 'MemberExpression' || part.object.type !== 'Identifier' || part.object.name !== '$'
            || !part.computed || part.property.type !== 'Literal' || !Number.isInteger(part.property.value)) {
            return;
        }
        found = true;
    });
    return found;
}

function emittedConstructions(ast, functionName, name) {
    const matches = [];
    const functions = [];
    visit(ast, (node) => {
        if (node.type !== 'FunctionDeclaration' || node.id?.name !== functionName) {
            return;
        }
        functions.push(node);
    });
    if (functions.length !== 1) {
        return matches;
    }
    const hasNativeCache = functions[0].body.body.some(statement => statement.type === 'VariableDeclaration'
        && statement.declarations.some(declaration => declaration.init?.type === 'CallExpression'
            && declaration.init.callee.type === 'Identifier' && declaration.init.callee.name === '_c'));
    if (!hasNativeCache) {
        return matches;
    }
    function walk(node, guarded = false) {
        if (!node || typeof node !== 'object' || !node.type) {
            return;
        }
        if (node !== functions[0] && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
            return;
        }
        if (node.type === 'IfStatement' && cacheGuard(node)) {
            walk(node.test, guarded);
            walk(node.consequent, true);
            walk(node.alternate, guarded);
            return;
        }
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === name && node.init) {
            matches.push({guarded, kind: unwrap(node.init).type});
        }
        for (const [key, value] of Object.entries(node)) {
            if (key === 'loc' || key === 'range' || key === 'parent') {
                continue;
            }
            for (const child of Array.isArray(value) ? value : [value]) {
                walk(child, guarded);
            }
        }
    }
    walk(functions[0]);
    return matches;
}

function loadEngines(appDirectory) {
    const app = path.resolve(appDirectory);
    const requireApp = createRequire(path.join(app, 'package.json'));
    return {
        versions: {node: process.versions.node, oxc: requireApp('oxc-transform-react/package.json').version},
        configPath: path.join(app, 'config/babel/oxcReactCompilerConfig.js'),
        oxc: requireApp('oxc-transform-react'),
        config: requireApp(path.join(app, 'config/babel/oxcReactCompilerConfig.js')),
    };
}

function analyzeSource(source, filename, engines) {
    const ext = path.extname(filename);
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
        throw new Error(`Unsupported input extension: ${filename}`);
    }
    try {
        const lang = {
            '.ts': 'ts', '.tsx': 'tsx', '.jsx': 'jsx', '.js': 'js',
        }[ext];
        const transformed = engines.oxc.transformSync(filename, source, {lang, reactCompiler: {...engines.config(), reportDiagnostics: true}});
        const diagnostics = (transformed.errors || []).map(error => ({message: error.message, severity: error.severity, labels: error.labels || []}));
        if (transformed.fatal) {
            return {
                filename, status: 'failed', diagnostics, findings: [],
            };
        }
        const plain = engines.oxc.transformSync(filename, source, {lang, reactCompiler: false});
        if (plain.fatal || plain.errors?.length) {
            throw new Error('OXC control transform failed');
        }
        const compiled = !plain.code.includes('react/compiler-runtime') && transformed.code.includes('react/compiler-runtime');
        let status = compiled ? 'compiled-output' : 'unchanged';
        if (diagnostics.length) {
            status = 'diagnostics';
        }
        const findings = [];
        if (status === 'compiled-output') {
            const original = parser.parse(source, {loc: true, range: true, jsx: ext !== '.ts'});
            const emitted = parser.parse(transformed.code, {loc: true, range: true, jsx: true});
            for (const candidate of sourceCandidates(original)) {
                const matches = emittedConstructions(emitted, candidate.function, candidate.value.name);
                if (matches.length === 1 && !matches[0].guarded && matches[0].kind === candidate.value.kind) {
                    findings.push({kind: 'oxc-unguarded-hook-crossing-candidate', ...candidate});
                }
            }
        }
        return {
            filename, status, diagnostics, findings,
        };
    } catch (error) {
        return {
            filename, status: 'failed', diagnostics: [], findings: [], failure: error.message,
        };
    }
}

function analyzeFiles(filenames, engines) {
    return [...new Set(filenames.map(filename => path.resolve(filename)))].sort().map((filename) => {
        try {
            return analyzeSource(fs.readFileSync(filename, 'utf8'), filename, engines);
        } catch (error) {
            return {
                filename, status: 'failed', diagnostics: [], findings: [], failure: error.message,
            };
        }
    });
}

export {analyzeFiles, analyzeSource, loadEngines};
