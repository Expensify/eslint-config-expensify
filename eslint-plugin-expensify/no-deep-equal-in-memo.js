/**
 * ESLint rule: no-deep-equal-in-memo
 *
 * Enforces using shallow comparisons instead of deep equality checks in React.memo
 * comparison functions for better performance.
 *
 * This rule implements the PERF-5 guideline: Use shallow comparisons instead of deep comparisons.
 */
import _ from 'lodash';

const name = 'no-deep-equal-in-memo';

const meta = {
    type: 'problem',
    docs: {
        description: 'Disallow deep equality checks in React.memo comparison functions. Use shallow comparisons of specific properties instead.',
        recommended: 'error',
    },
    schema: [],
    messages: {
        noDeepEqualInMemo: 'Avoid using deep equality checks ({{functionName}}) in React.memo. Compare specific relevant properties with shallow equality instead for better performance.',
    },
};

/**
 * Set of deep comparison function names to detect
 */
const DEEP_COMPARISON_FUNCTIONS = new Set([
    'deepEqual',
    'isEqual',
]);

/**
 * Check if a call expression is a deep comparison function
 * @param {Node} node - The CallExpression node
 * @returns {{isDeepComparison: boolean, functionName: string|null}}
 */
function isDeepComparisonCall(node) {
    if (node.type !== 'CallExpression') {
        return {isDeepComparison: false, functionName: null};
    }

    // Check for direct function calls: deepEqual(), isEqual()
    if (node.callee.type === 'Identifier' && DEEP_COMPARISON_FUNCTIONS.has(node.callee.name)) {
        return {isDeepComparison: true, functionName: node.callee.name};
    }

    // Check for lodash calls: _.isEqual()
    if (
        node.callee.type === 'MemberExpression'
        && node.callee.object.type === 'Identifier'
        && node.callee.object.name === '_'
        && node.callee.property.type === 'Identifier'
        && DEEP_COMPARISON_FUNCTIONS.has(node.callee.property.name)
    ) {
        return {isDeepComparison: true, functionName: `_.${node.callee.property.name}`};
    }

    return {isDeepComparison: false, functionName: null};
}

/**
 * Check if a call expression is React.memo or memo
 * @param {Node} node - The CallExpression node
 * @returns {boolean}
 */
function isReactMemoCall(node) {
    if (node.type !== 'CallExpression') {
        return false;
    }

    // Check for React.memo()
    if (
        node.callee.type === 'MemberExpression'
        && node.callee.object.type === 'Identifier'
        && node.callee.object.name === 'React'
        && node.callee.property.type === 'Identifier'
        && node.callee.property.name === 'memo'
    ) {
        return true;
    }

    // Check for memo() (named import)
    if (node.callee.type === 'Identifier' && node.callee.name === 'memo') {
        return true;
    }

    return false;
}

/**
 * Traverse AST to find deep comparison calls
 * @param {Node} node - The node to traverse
 * @param {Function} callback - Called when a deep comparison is found
 * @param {Set<Node>} visited - Set of visited nodes to prevent cycles
 */
function traverseForDeepComparisons(node, callback, visited = new Set()) {
    if (!node || !node.type || visited.has(node)) {
        return;
    }

    visited.add(node);

    // Check if this node is a deep comparison call
    const {isDeepComparison, functionName} = isDeepComparisonCall(node);
    if (isDeepComparison) {
        callback(node, functionName);
    }

    // Traverse child nodes
    for (const key of _.keys(node)) {
        // Skip metadata and parent references to avoid cycles
        if (key === 'parent' || key === 'type' || key === 'range' || key === 'loc') {
            continue;
        }

        const value = node[key];

        if (_.isArray(value)) {
            for (const item of value) {
                if (item && typeof item === 'object' && item.type) {
                    traverseForDeepComparisons(item, callback, visited);
                }
            }
        } else if (value && typeof value === 'object' && value.type) {
            traverseForDeepComparisons(value, callback, visited);
        }
    }
}

function create(context) {
    return {
        CallExpression(node) {
            // Check if this is a React.memo() or memo() call
            if (!isReactMemoCall(node)) {
                return;
            }

            // Check if there's a second argument (comparison function)
            if (node.arguments.length < 2) {
                return;
            }

            const comparisonFunction = node.arguments[1];

            // The comparison function should be a function expression or arrow function
            if (
                comparisonFunction.type !== 'FunctionExpression'
                && comparisonFunction.type !== 'ArrowFunctionExpression'
            ) {
                return;
            }

            // Traverse the comparison function to find deep comparison calls
            const visited = new Set();
            traverseForDeepComparisons(
                comparisonFunction.body,
                (deepComparisonNode, functionName) => {
                    context.report({
                        node: deepComparisonNode,
                        messageId: 'noDeepEqualInMemo',
                        data: {
                            functionName,
                        },
                    });
                },
                visited,
            );
        },
    };
}

export {name, meta, create};

