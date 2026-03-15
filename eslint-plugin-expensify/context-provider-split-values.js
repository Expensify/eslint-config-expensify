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
 * Check if a CallExpression calls createContext (plain or as React.createContext).
 * @param {object} node - AST node
 * @returns {boolean}
 */
function isCreateContextCall(node) {
    if (!node || node.type !== 'CallExpression') {
        return false;
    }
    const callee = node.callee;
    if (callee.type === 'Identifier' && callee.name === 'createContext') {
        return true;
    }
    return (
        callee.type === 'MemberExpression'
        && callee.property
        && callee.property.type === 'Identifier'
        && callee.property.name === 'createContext'
    );
}

/**
 * Determine whether a JSX element is a React context provider.
 * Uses structural detection: any `<X.Provider>` member expression is treated as a
 * context provider. For React 19 shorthand (`<Ctx value={...}>`), traces the
 * identifier back to a `createContext()` call in the same file.
 * @param {object} node - JSXOpeningElement node
 * @param {object} ruleContext - ESLint rule context (needed for scope resolution)
 * @returns {boolean}
 */
function isContextProvider(node, ruleContext) {
    const elementName = getJSXElementName(node);
    if (!elementName) {
        return false;
    }

    if (elementName.endsWith('.Provider')) {
        return true;
    }

    // React 19 shorthand: <Ctx value={...}> without .Provider
    // Skip intrinsic/HTML elements (lowercase names) — they can never be context providers.
    if (node.name && node.name.type === 'JSXIdentifier') {
        const identName = node.name.name;
        if (identName[0] && identName[0] === identName[0].toLowerCase()) {
            return false;
        }
        const init = findVariableInit(ruleContext, node, identName);
        if (init && isCreateContextCall(init)) {
            return true;
        }
    }

    return false;
}

/**
 * Check whether `variable` is destructured at `index` from an array-pattern hook call
 * (e.g. `const [value, setter] = hookName(...)`).
 * @param {object} variable - ESLint scope Variable
 * @param {string} hookName - e.g. "useState", "useReducer"
 * @param {number} index - expected position in the array destructuring
 * @returns {boolean}
 */
function isHookDestructuredAtIndex(variable, hookName, index) {
    if (!variable || !variable.defs || !variable.defs.length) {
        return false;
    }
    const def = variable.defs[0];
    if (def.type !== 'Variable' || !def.node || def.node.type !== 'VariableDeclarator') {
        return false;
    }
    if (!isHookCall(def.node.init, hookName)) {
        return false;
    }
    const pattern = def.node.id;
    if (!pattern || pattern.type !== 'ArrayPattern') {
        return false;
    }
    return pattern.elements.indexOf(def.name) === index;
}

function isUseStateSetter(variable) {
    return isHookDestructuredAtIndex(variable, 'useState', 1);
}

function isUseStateValue(variable) {
    return isHookDestructuredAtIndex(variable, 'useState', 0);
}

function isUseReducerDispatch(variable) {
    return isHookDestructuredAtIndex(variable, 'useReducer', 1);
}

function isUseReducerState(variable) {
    return isHookDestructuredAtIndex(variable, 'useReducer', 0);
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
 * Handles: function expressions, useCallback, useMemo, useState/useReducer destructuring,
 * function declarations, literals, objects, arrays, conditional, logical, and other expressions.
 * Returns null for anything that cannot be confidently classified.
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

    if (
        unwrapped.type === 'UnaryExpression'
        || unwrapped.type === 'BinaryExpression'
        || unwrapped.type === 'UpdateExpression'
        || unwrapped.type === 'NewExpression'
    ) {
        return 'data';
    }

    if (unwrapped.type === 'ConditionalExpression') {
        const cons = classifyValue(unwrapped.consequent, context, scopeNode, seen);
        const alt = classifyValue(unwrapped.alternate, context, scopeNode, seen);
        if (cons && cons === alt) {
            return cons;
        }
        return null;
    }

    if (unwrapped.type === 'LogicalExpression') {
        const left = classifyValue(unwrapped.left, context, scopeNode, seen);
        const right = classifyValue(unwrapped.right, context, scopeNode, seen);
        if (left && left === right) {
            return left;
        }
        return null;
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
            if (isUseStateSetter(variable) || isUseReducerDispatch(variable)) {
                return 'function';
            }
            if (isUseStateValue(variable) || isUseReducerState(variable)) {
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
        }

        // When classification is null (unresolvable), skip the property entirely.
        // This avoids false positives from guessing based on property names.
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
            const valueProp = getValueProp(node.attributes);
            if (!valueProp) {
                return;
            }

            if (!isContextProvider(node, context)) {
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
                    data: {
                        contextName: getJSXElementName(node),
                        functionProps: analysis.functionProps.join(', '),
                        nonFunctionProps: analysis.nonFunctionProps.join(', '),
                    },
                });
            }
        },
    };
}

export {name, meta, create};
