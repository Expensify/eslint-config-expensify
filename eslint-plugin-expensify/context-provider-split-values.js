import CONST from './CONST.js';

const name = 'context-provider-split-values';

const meta = {
    type: 'suggestion',
    docs: {
        description:
            'Enforce that React Context Providers do not mix data (state) and functions (actions) in the same context value. '
            + 'Use separate context providers when you have both.',
        recommended: 'error',
    },
    schema: [],
    messages: {
        contextMixesDataAndFunctions:
            CONST.MESSAGE.CONTEXT_MIXES_DATA_AND_FUNCTIONS,
    },
};

/**
 * Matches camelCase verb prefixes that indicate a function name.
 * Requires the prefix to be followed by an uppercase letter (camelCase boundary)
 * or be the entire name (single-word function names like "submit" or "dispatch").
 */
// eslint-disable-next-line max-len
const FUNCTION_NAME_PATTERN = /^(on|handle|set|get|do|create|update|delete|fetch|load|save|remove|add|toggle|clear|reset|submit|validate|format|parse|convert|transform|dispatch|register|unregister|open|close|initialize|select)([A-Z]|$)/;

/**
 * @param {string} identifier
 * @returns {boolean}
 */
function looksLikeFunctionName(identifier) {
    return typeof identifier === 'string' && FUNCTION_NAME_PATTERN.test(identifier);
}

/**
 * Get the full dotted name of a JSX element (e.g. "MyContext.Provider").
 * @param {object} node - JSXOpeningElement node
 * @returns {string|null}
 */
function getJSXElementName(node) {
    if (!node || !node.name) {
        return null;
    }

    if (node.name.type === 'JSXMemberExpression') {
        const parts = [];
        let current = node.name;
        while (current) {
            if (current.type === 'JSXMemberExpression') {
                if (current.property && current.property.name) {
                    parts.unshift(current.property.name);
                }
                current = current.object;
            } else if (current.type === 'JSXIdentifier') {
                parts.unshift(current.name);
                break;
            } else {
                break;
            }
        }
        return parts.join('.');
    }

    if (node.name.type === 'JSXIdentifier') {
        return node.name.name;
    }
    return null;
}

/**
 * Determine whether a JSX element is a React context provider.
 * Matches both `<XContext.Provider value={...}>` and `<XContext value={...}>` (React 19).
 * @param {object} node - JSXOpeningElement node
 * @returns {boolean}
 */
function isContextProvider(node) {
    const elementName = getJSXElementName(node);
    if (!elementName) {
        return false;
    }

    if (elementName.endsWith('.Provider') && elementName.includes('Context')) {
        return true;
    }

    // React 19 shorthand: <SomeContext value={...}> without .Provider
    if (/Context$/.test(elementName)) {
        return true;
    }

    return false;
}

/**
 * Extract the expression passed to the `value` JSX prop.
 * @param {Array} attributes - JSX attributes array
 * @returns {object|null}
 */
function getValueProp(attributes) {
    if (!attributes) {
        return null;
    }

    for (let i = 0; i < attributes.length; i++) {
        const a = attributes[i];
        if (a.type === 'JSXAttribute' && a.name && a.name.name === 'value') {
            if (!a.value) {
                return null;
            }
            if (a.value.type === 'JSXExpressionContainer') {
                return a.value.expression;
            }
            return a.value;
        }
    }
    return null;
}

/**
 * @param {object} context - ESLint rule context
 * @param {object} node - AST node used for scope resolution
 * @returns {object} scope
 */
function getScopeForNode(context, node) {
    const sourceCode = context.sourceCode || context.getSourceCode();
    return sourceCode.getScope(node);
}

/**
 * Walk the scope chain to find a variable by name.
 * @param {object} context - ESLint rule context
 * @param {object} scopeNode - AST node for scope resolution
 * @param {string} identifierName - variable name
 * @returns {object|null} ESLint scope Variable
 */
function findScopeVariable(context, scopeNode, identifierName) {
    let scope = getScopeForNode(context, scopeNode);
    while (scope) {
        for (let i = 0; i < scope.variables.length; i++) {
            if (scope.variables[i].name === identifierName) {
                return scope.variables[i];
            }
        }
        scope = scope.upper;
    }
    return null;
}

/**
 * Return the initializer expression for a variable declaration (e.g. the RHS of `const x = <init>`).
 * @param {object} context - ESLint rule context
 * @param {object} scopeNode - AST node for scope resolution
 * @param {string} identifierName - variable name
 * @returns {object|null} AST node of the initializer
 */
function findVariableInit(context, scopeNode, identifierName) {
    const variable = findScopeVariable(context, scopeNode, identifierName);
    if (!variable || !variable.defs || !variable.defs.length) {
        return null;
    }
    const def = variable.defs[0];
    if (def.type !== 'Variable' || !def.node || def.node.type !== 'VariableDeclarator') {
        return null;
    }
    return def.node.init || null;
}

/**
 * Check if a CallExpression calls a specific hook (plain or as React.hookName).
 * @param {object} node - AST node
 * @param {string} hookName - e.g. "useState", "useCallback"
 * @returns {boolean}
 */
function isHookCall(node, hookName) {
    if (!node || node.type !== 'CallExpression') {
        return false;
    }
    const callee = node.callee;
    if (callee.type === 'Identifier' && callee.name === hookName) {
        return true;
    }
    return (
        callee.type === 'MemberExpression'
        && callee.property
        && callee.property.type === 'Identifier'
        && callee.property.name === hookName
    );
}

/**
 * Check whether `variable` is the setter (index 1) from `const [s, setS] = useState(...)`.
 * @param {object} variable - ESLint scope Variable
 * @returns {boolean}
 */
function isUseStateSetter(variable) {
    if (!variable || !variable.defs || !variable.defs.length) {
        return false;
    }
    const def = variable.defs[0];
    if (def.type !== 'Variable' || !def.node || def.node.type !== 'VariableDeclarator') {
        return false;
    }
    if (!isHookCall(def.node.init, 'useState')) {
        return false;
    }
    const pattern = def.node.id;
    if (!pattern || pattern.type !== 'ArrayPattern') {
        return false;
    }
    return pattern.elements.indexOf(def.name) === 1;
}

/**
 * Check whether `variable` is the state value (index 0) from `const [s, setS] = useState(...)`.
 * @param {object} variable - ESLint scope Variable
 * @returns {boolean}
 */
function isUseStateValue(variable) {
    if (!variable || !variable.defs || !variable.defs.length) {
        return false;
    }
    const def = variable.defs[0];
    if (def.type !== 'Variable' || !def.node || def.node.type !== 'VariableDeclarator') {
        return false;
    }
    if (!isHookCall(def.node.init, 'useState')) {
        return false;
    }
    const pattern = def.node.id;
    if (!pattern || pattern.type !== 'ArrayPattern') {
        return false;
    }
    return pattern.elements.indexOf(def.name) === 0;
}

/**
 * @param {object} node - AST node
 * @returns {boolean}
 */
function isFunctionNode(node) {
    return (
        node
        && (node.type === 'ArrowFunctionExpression'
            || node.type === 'FunctionExpression')
    );
}

/**
 * Extract the effective return value from a useMemo / useCallback factory function.
 * Handles both expression bodies and block bodies with a top-level return.
 * @param {object} factoryNode - the factory function AST node
 * @returns {object|null}
 */
function getFactoryReturnNode(factoryNode) {
    if (!factoryNode || !isFunctionNode(factoryNode)) {
        return null;
    }

    // Expression body: () => <expression>
    if (factoryNode.body.type !== 'BlockStatement') {
        return factoryNode.body;
    }

    // Block body: first top-level return
    const stmts = factoryNode.body.body;
    for (let i = 0; i < stmts.length; i++) {
        if (stmts[i].type === 'ReturnStatement' && stmts[i].argument) {
            return stmts[i].argument;
        }
    }
    return null;
}

/**
 * Strip TypeScript type-assertion wrappers so we can inspect the underlying expression.
 * @param {object} node - AST node
 * @returns {object}
 */
function unwrapTSNode(node) {
    if (!node) {
        return node;
    }
    if (
        node.type === 'TSAsExpression'
        || node.type === 'TSSatisfiesExpression'
        || node.type === 'TSNonNullExpression'
        || node.type === 'TSTypeAssertion'
    ) {
        return unwrapTSNode(node.expression);
    }
    return node;
}

/**
 * Classify an AST value node as "function", "data", or null (unknown).
 *
 * Handles: function expressions, useCallback, useMemo, useState destructuring,
 * function declarations, literals, objects, arrays, unary/binary/logical expressions,
 * and falls back to naming conventions for unresolvable identifiers.
 *
 * @param {object} node - AST node to classify
 * @param {object} context - ESLint rule context
 * @param {object} scopeNode - AST node for scope resolution
 * @param {Set} visited - set of already-visited identifier names (prevents cycles)
 * @returns {string|null} "function", "data", or null
 */
function classifyValue(node, context, scopeNode, visited) {
    const seen = visited || new Set();
    const unwrapped = unwrapTSNode(node);
    if (!unwrapped) {
        return null;
    }

    if (isFunctionNode(unwrapped)) {
        return 'function';
    }

    if (
        unwrapped.type === 'Literal'
        || unwrapped.type === 'TemplateLiteral'
        || unwrapped.type === 'ArrayExpression'
        || unwrapped.type === 'ObjectExpression'
    ) {
        return 'data';
    }

    // Expressions that always produce a non-function value
    if (
        unwrapped.type === 'UnaryExpression'
        || unwrapped.type === 'BinaryExpression'
        || unwrapped.type === 'LogicalExpression'
        || unwrapped.type === 'UpdateExpression'
        || unwrapped.type === 'NewExpression'
    ) {
        return 'data';
    }

    if (unwrapped.type === 'CallExpression') {
        if (isHookCall(unwrapped, 'useCallback')) {
            return 'function';
        }

        if (isHookCall(unwrapped, 'useMemo')) {
            const factory = unwrapped.arguments[0];
            const returnNode = getFactoryReturnNode(factory);
            if (returnNode) {
                return classifyValue(returnNode, context, scopeNode, seen);
            }
            return null;
        }

        // useRef always returns a data object
        if (isHookCall(unwrapped, 'useRef')) {
            return 'data';
        }

        return null;
    }

    if (unwrapped.type === 'Identifier') {
        if (seen.has(unwrapped.name)) {
            return null;
        }
        seen.add(unwrapped.name);

        const variable = findScopeVariable(context, scopeNode, unwrapped.name);
        if (variable) {
            if (isUseStateSetter(variable)) {
                return 'function';
            }
            if (isUseStateValue(variable)) {
                return 'data';
            }
            if (variable.defs && variable.defs.length && variable.defs[0].type === 'FunctionName') {
                return 'function';
            }
        }

        const init = findVariableInit(context, scopeNode, unwrapped.name);
        if (init) {
            return classifyValue(init, context, scopeNode, seen);
        }

        return looksLikeFunctionName(unwrapped.name) ? 'function' : null;
    }

    if (unwrapped.type === 'MemberExpression') {
        const propName = (unwrapped.property && unwrapped.property.type === 'Identifier')
            ? unwrapped.property.name
            : null;
        if (propName && looksLikeFunctionName(propName)) {
            return 'function';
        }
        return null;
    }

    return null;
}

/**
 * Resolve a node to the underlying ObjectExpression, unwrapping identifiers,
 * useMemo calls, and TypeScript wrappers along the way.
 *
 * @param {object} node - AST node
 * @param {object} context - ESLint rule context
 * @param {object} scopeNode - AST node for scope resolution
 * @returns {object|null} ObjectExpression node or null
 */
function resolveToObject(node, context, scopeNode) {
    const unwrapped = unwrapTSNode(node);
    if (!unwrapped) {
        return null;
    }

    if (unwrapped.type === 'ObjectExpression') {
        return unwrapped;
    }

    if (unwrapped.type === 'Identifier') {
        const init = findVariableInit(context, scopeNode, unwrapped.name);
        if (init) {
            return resolveToObject(init, context, scopeNode);
        }
        return null;
    }

    if (
        unwrapped.type === 'CallExpression'
        && isHookCall(unwrapped, 'useMemo')
    ) {
        const factory = unwrapped.arguments[0];
        const returnNode = getFactoryReturnNode(factory);
        if (returnNode) {
            return resolveToObject(returnNode, context, scopeNode);
        }
        return null;
    }

    return null;
}

/**
 * Walk every property (including spreads) of an ObjectExpression and determine
 * whether the object contains functions, non-function data, or both.
 *
 * @param {object} objectNode - ObjectExpression AST node
 * @param {object} context - ESLint rule context
 * @param {object} scopeNode - AST node for scope resolution
 * @param {Set} visited - set of already-visited object nodes (prevents cycles)
 * @returns {{hasFunctions: boolean, hasNonFunctions: boolean, functionProps: string[], nonFunctionProps: string[]}}
 */
function analyzeObjectProperties(objectNode, context, scopeNode, visited) {
    const seen = visited || new Set();
    const result = {
        hasFunctions: false,
        hasNonFunctions: false,
        functionProps: [],
        nonFunctionProps: [],
    };

    if (!objectNode || objectNode.type !== 'ObjectExpression') {
        return result;
    }
    if (seen.has(objectNode)) {
        return result;
    }
    seen.add(objectNode);

    for (let i = 0; i < objectNode.properties.length; i++) {
        const prop = objectNode.properties[i];

        // Spreads: recursively analyse if we can resolve the spread target
        if (prop.type === 'SpreadElement') {
            let spreadObj = prop.argument;
            if (spreadObj && spreadObj.type === 'Identifier') {
                const resolved = resolveToObject(spreadObj, context, scopeNode);
                if (resolved) {
                    spreadObj = resolved;
                }
            }
            if (spreadObj && spreadObj.type === 'ObjectExpression') {
                const sub = analyzeObjectProperties(spreadObj, context, scopeNode, seen);
                if (sub.hasFunctions) {
                    result.hasFunctions = true;
                    result.functionProps.push(...sub.functionProps);
                }
                if (sub.hasNonFunctions) {
                    result.hasNonFunctions = true;
                    result.nonFunctionProps.push(...sub.nonFunctionProps);
                }
            }
            continue;
        }

        const propName = (prop.key && (prop.key.name || prop.key.value)) || 'unknown';
        const classification = classifyValue(prop.value, context, scopeNode);

        if (classification === 'function') {
            result.hasFunctions = true;
            result.functionProps.push(propName);
        } else if (classification === 'data') {
            result.hasNonFunctions = true;
            result.nonFunctionProps.push(propName);
        } else if (looksLikeFunctionName(propName)) {
            // Last resort: use the property name itself as a heuristic
            result.hasFunctions = true;
            result.functionProps.push(propName);
        } else {
            result.hasNonFunctions = true;
            result.nonFunctionProps.push(propName);
        }
    }

    return result;
}

/**
 * @param {object} context - ESLint rule context
 * @returns {object} visitor
 */
function create(context) {
    return {
        JSXOpeningElement(node) {
            if (!isContextProvider(node)) {
                return;
            }

            const valueProp = getValueProp(node.attributes);
            if (!valueProp) {
                return;
            }

            const objectToAnalyze = resolveToObject(valueProp, context, node);
            if (!objectToAnalyze) {
                return;
            }

            const analysis = analyzeObjectProperties(objectToAnalyze, context, node);

            if (analysis.hasFunctions && analysis.hasNonFunctions) {
                context.report({
                    node,
                    messageId: 'contextMixesDataAndFunctions',
                    data: {contextName: getJSXElementName(node)},
                });
            }
        },
    };
}

export {name, meta, create};
