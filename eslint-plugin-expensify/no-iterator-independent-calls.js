import CONST from './CONST.js';

const name = 'no-iterator-independent-calls';

const meta = {
    type: 'suggestion',
    docs: {
        description: 'Disallow function calls inside array iteration callbacks that do not depend on the iterator variable',
        category: 'Performance',
        recommended: false,
    },
    schema: [],
    messages: {
        iteratorIndependentCall: CONST.MESSAGE.NO_ITERATOR_INDEPENDENT_CALLS,
    },
};

/**
 * Array methods that this rule applies to
 */
const ARRAY_METHODS = new Set([
    'map',
    'reduce',
    'reduceRight',
    'filter',
    'some',
    'every',
    'find',
    'findIndex',
    'flatMap',
    'forEach',
]);


/**
 * Check if a node is an array method call expression
 * @param {Object} node - CallExpression node
 * @returns {{isArrayMethod: boolean, methodName: string|null}}
 */
function getArrayMethodInfo(node) {
    if (
        node.type !== 'CallExpression'
        || node.callee.type !== 'MemberExpression'
        || node.callee.property.type !== 'Identifier'
    ) {
        return { isArrayMethod: false, methodName: null };
    }

    const methodName = node.callee.property.name;
    return {
        isArrayMethod: ARRAY_METHODS.has(methodName),
        methodName,
    };
}

/**
 * Get the callback function from an array method call
 * @param {Object} node - CallExpression node
 * @param {string} methodName - Name of the array method
 * @returns {Object|null} - The callback function node
 */
function getCallback(node, methodName) {
    // reduce/reduceRight have callback as first arg
    // All other methods also have callback as first arg
    const callback = node.arguments[0];

    if (!callback) {
        return null;
    }

    if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
        return callback;
    }

    return null;
}

/**
 * Get iterator parameters from callback
 * For reduce: (acc, item, index, array)
 * For others: (item, index, array)
 * @param {Object} callback - Function node
 * @param {string} methodName - Name of the array method
 * @returns {Set<string>} - Set of parameter names that represent iterator-related values
 */
function getIteratorParams(callback, methodName) {
    const params = new Set();
    const callbackParams = callback.params;

    if (!callbackParams || callbackParams.length === 0) {
        return params;
    }

    const isReduce = methodName === 'reduce' || methodName === 'reduceRight';

    if (isReduce) {
        // reduce: (accumulator, currentValue, index, array)
        if (callbackParams[0] && callbackParams[0].type === 'Identifier') {
            params.add(callbackParams[0].name); // accumulator
        }
        if (callbackParams[1] && callbackParams[1].type === 'Identifier') {
            params.add(callbackParams[1].name); // currentValue (iterator)
        }
        if (callbackParams[2] && callbackParams[2].type === 'Identifier') {
            params.add(callbackParams[2].name); // index
        }
        if (callbackParams[3] && callbackParams[3].type === 'Identifier') {
            params.add(callbackParams[3].name); // array
        }
    } else {
        // map, filter, etc: (element, index, array)
        if (callbackParams[0] && callbackParams[0].type === 'Identifier') {
            params.add(callbackParams[0].name); // element (iterator)
        }
        if (callbackParams[1] && callbackParams[1].type === 'Identifier') {
            params.add(callbackParams[1].name); // index
        }
        if (callbackParams[2] && callbackParams[2].type === 'Identifier') {
            params.add(callbackParams[2].name); // array
        }
    }

    return params;
}

/**
 * Get the full function name including object for method calls
 * @param {Object} node - CallExpression node
 * @returns {string}
 */
function getFunctionName(node) {
    if (node.callee.type === 'Identifier') {
        return node.callee.name;
    }

    if (node.callee.type === 'MemberExpression') {
        const parts = [];
        let current = node.callee;

        while (current.type === 'MemberExpression') {
            if (current.property.type === 'Identifier') {
                parts.unshift(current.property.name);
            }
            current = current.object;
        }

        if (current.type === 'Identifier') {
            parts.unshift(current.name);
        }

        return parts.join('.');
    }

    return '<anonymous>';
}

/**
 * Check if a node references any of the iterator parameters
 * @param {Object} node - AST node
 * @param {Set<string>} iteratorParams - Set of iterator parameter names
 * @param {Set<Object>} visited - Already visited nodes
 * @returns {boolean}
 */
function usesIteratorParam(node, iteratorParams, visited = new Set()) {
    if (!node || visited.has(node)) {
        return false;
    }

    visited.add(node);

    // Direct identifier reference
    if (node.type === 'Identifier') {
        return iteratorParams.has(node.name);
    }

    // Member expression - check if the root object is an iterator param
    if (node.type === 'MemberExpression') {
        return usesIteratorParam(node.object, iteratorParams, visited);
    }

    // Call expression - check callee and arguments
    if (node.type === 'CallExpression') {
        // Check if method is called on iterator (e.g., item.getValue())
        if (
            node.callee.type === 'MemberExpression'
            && usesIteratorParam(node.callee.object, iteratorParams, visited)
        ) {
            return true;
        }

        // Check arguments
        return node.arguments.some(arg => usesIteratorParam(arg, iteratorParams, visited));
    }

    // Binary/Logical expressions
    if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
        return (
            usesIteratorParam(node.left, iteratorParams, visited)
            || usesIteratorParam(node.right, iteratorParams, visited)
        );
    }

    // Conditional expression
    if (node.type === 'ConditionalExpression') {
        return (
            usesIteratorParam(node.test, iteratorParams, visited)
            || usesIteratorParam(node.consequent, iteratorParams, visited)
            || usesIteratorParam(node.alternate, iteratorParams, visited)
        );
    }

    // Array expression
    if (node.type === 'ArrayExpression') {
        return node.elements.some(el => el && usesIteratorParam(el, iteratorParams, visited));
    }

    // Object expression
    if (node.type === 'ObjectExpression') {
        return node.properties.some((prop) => {
            if (prop.type === 'SpreadElement') {
                return usesIteratorParam(prop.argument, iteratorParams, visited);
            }
            return (
                usesIteratorParam(prop.key, iteratorParams, visited)
                || usesIteratorParam(prop.value, iteratorParams, visited)
            );
        });
    }

    // Template literal
    if (node.type === 'TemplateLiteral') {
        return node.expressions.some(expr => usesIteratorParam(expr, iteratorParams, visited));
    }

    // Unary expression
    if (node.type === 'UnaryExpression') {
        return usesIteratorParam(node.argument, iteratorParams, visited);
    }

    // Spread element
    if (node.type === 'SpreadElement') {
        return usesIteratorParam(node.argument, iteratorParams, visited);
    }

    // Sequence expression
    if (node.type === 'SequenceExpression') {
        return node.expressions.some(expr => usesIteratorParam(expr, iteratorParams, visited));
    }

    return false;
}

/**
 * Check if a call expression is inside a conditional that depends on the iterator
 * @param {Object} callNode - CallExpression node
 * @param {Object} callbackBody - The callback body node
 * @param {Set<string>} iteratorParams - Set of iterator parameter names
 * @returns {boolean}
 */
function isInsideIteratorDependentConditional(callNode, callbackBody, iteratorParams) {
    let current = callNode.parent;

    while (current && current !== callbackBody) {
        // Logical expressions with short-circuit evaluation
        if (current.type === 'LogicalExpression') {
            // Check if the left side uses iterator (determines if right side executes)
            if (usesIteratorParam(current.left, iteratorParams)) {
                return true;
            }
        }

        // Conditional expression
        if (current.type === 'ConditionalExpression') {
            if (usesIteratorParam(current.test, iteratorParams)) {
                return true;
            }
        }

        // If statement
        if (current.type === 'IfStatement') {
            if (usesIteratorParam(current.test, iteratorParams)) {
                return true;
            }
        }

        current = current.parent;
    }

    return false;
}


/**
 * Collect all call expressions from a node
 * @param {Object} node - AST node
 * @param {Array<Object>} calls - Array to collect calls into
 * @param {Set<Object>} visited - Already visited nodes
 */
function collectCallExpressions(node, calls, visited = new Set()) {
    if (!node || visited.has(node)) {
        return;
    }

    visited.add(node);

    if (node.type === 'CallExpression') {
        calls.push(node);
    }

    // Traverse child nodes
    const keys = Object.keys(node);
    for (const key of keys) {
        if (key === 'parent' || key === 'type' || key === 'range' || key === 'loc') {
            continue;
        }

        const value = node[key];

        if (Array.isArray(value)) {
            for (const item of value) {
                if (item && typeof item === 'object' && item.type) {
                    collectCallExpressions(item, calls, visited);
                }
            }
        } else if (value && typeof value === 'object' && value.type) {
            collectCallExpressions(value, calls, visited);
        }
    }
}

/**
 * Get the callback body (handling both expression and block bodies)
 * @param {Object} callback - Function node
 * @returns {Object}
 */
function getCallbackBody(callback) {
    return callback.body;
}

function create(context) {
    return {
        CallExpression(node) {
            const { isArrayMethod, methodName } = getArrayMethodInfo(node);

            if (!isArrayMethod) {
                return;
            }

            const callback = getCallback(node, methodName);
            if (!callback) {
                return;
            }

            const iteratorParams = getIteratorParams(callback, methodName);
            if (iteratorParams.size === 0) {
                return; // No parameters to check against
            }

            const callbackBody = getCallbackBody(callback);

            // Collect all call expressions in the callback body
            const callExpressions = [];
            collectCallExpressions(callbackBody, callExpressions);

            // Filter to find iterator-independent calls
            for (const callExpr of callExpressions) {
                // Skip if this is the array method call itself
                if (callExpr === node) {
                    continue;
                }

                // Skip if this is a nested array method (will be checked separately)
                const nestedInfo = getArrayMethodInfo(callExpr);
                if (nestedInfo.isArrayMethod && callExpr.arguments[0]) {
                    // Only skip if it has a callback - we'll analyze it separately
                    const nestedCallback = getCallback(callExpr, nestedInfo.methodName);
                    if (nestedCallback) {
                        continue;
                    }
                }

                const funcName = getFunctionName(callExpr);

                // Check if the call uses iterator params
                const usesIterator = usesIteratorParam(callExpr, iteratorParams);
                if (usesIterator) {
                    continue;
                }

                // Check if it's inside an iterator-dependent conditional
                if (isInsideIteratorDependentConditional(callExpr, callbackBody, iteratorParams)) {
                    continue;
                }

                // Get the first iterator param name for the error message
                const iteratorName = iteratorParams.values().next().value;

                context.report({
                    node: callExpr,
                    messageId: 'iteratorIndependentCall',
                    data: {
                        call: funcName + '()',
                        iterator: iteratorName,
                        method: methodName,
                    },
                });
            }
        },
    };
}

export { name, meta, create };
