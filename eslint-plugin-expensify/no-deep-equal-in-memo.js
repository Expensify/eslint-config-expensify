import _ from 'lodash';
import CONST from './CONST.js';

const meta = {
    type: 'problem',
    docs: {
        description:
      'Disallow deep equality checks in React.memo comparison functions',
        recommended: 'error',
    },
    schema: [],
    messages: {
        noDeepEqualInMemo: CONST.MESSAGE.NO_DEEP_EQUAL_IN_MEMO,
    },
};

const DEEP_EQUAL_FUNCTIONS = new Set(['deepEqual', 'isEqual', 'isDeepEqual']);

/**
 * Check if a node is a React.memo or memo call
 * @param {Object} node
 * @returns {Boolean}
 */
function isMemoCall(node) {
    if (node.type !== 'CallExpression') {
        return false;
    }

    const callee = node.callee;

    // Check for React.memo()
    if (callee.type === 'MemberExpression') {
        const object = _.get(callee, 'object.name');
        const property = _.get(callee, 'property.name');
        return object === 'React' && property === 'memo';
    }

    // Check for memo()
    if (callee.type === 'Identifier') {
        return callee.name === 'memo';
    }

    return false;
}

/**
 * Check if a node is a deep equality function call
 * @param {Object} node
 * @returns {Boolean}
 */
function isDeepEqualCall(node) {
    if (node.type !== 'CallExpression') {
        return false;
    }

    const callee = node.callee;

    // Check for direct function calls like deepEqual(), isEqual(), etc.
    if (callee.type === 'Identifier') {
        return DEEP_EQUAL_FUNCTIONS.has(callee.name);
    }

    // Check for method calls like _.isEqual(), lodash.isEqual(), etc.
    if (callee.type === 'MemberExpression') {
        const methodName = _.get(callee, 'property.name');
        return DEEP_EQUAL_FUNCTIONS.has(methodName);
    }

    return false;
}

/**
 * Check if a node is a JSON.stringify comparison
 * @param {Object} node
 * @returns {Boolean}
 */
function isJSONStringifyComparison(node) {
    if (node.type !== 'BinaryExpression') {
        return false;
    }

    const {left, right, operator} = node;

    // Check if operator is === or !==
    if (operator !== '===' && operator !== '!==') {
        return false;
    }

    // Check if either side is JSON.stringify()
    const isLeftStringify = left.type === 'CallExpression'
    && left.callee.type === 'MemberExpression'
    && _.get(left, 'callee.object.name') === 'JSON'
    && _.get(left, 'callee.property.name') === 'stringify';

    const isRightStringify = right.type === 'CallExpression'
    && right.callee.type === 'MemberExpression'
    && _.get(right, 'callee.object.name') === 'JSON'
    && _.get(right, 'callee.property.name') === 'stringify';

    return isLeftStringify || isRightStringify;
}

/**
 * Recursively check if a node or its descendants contain deep equality checks
 * @param {Object} node
 * @param {Object} context
 */
function checkForDeepEqual(node, context) {
    if (!node) {
        return;
    }

    // Check if current node is a deep equal call
    if (isDeepEqualCall(node)) {
        context.report({
            node,
            messageId: 'noDeepEqualInMemo',
        });
        return;
    }

    // Check if current node is a JSON.stringify comparison
    if (isJSONStringifyComparison(node)) {
        context.report({
            node,
            messageId: 'noDeepEqualInMemo',
        });
        return;
    }

    // Recursively check child nodes
    _.keys(node).forEach((key) => {
        if (key === 'parent' || key === 'loc' || key === 'range') {
            return;
        }

        const child = node[key];

        if (_.isArray(child)) {
            child.forEach(item => checkForDeepEqual(item, context));
        } else if (child && typeof child === 'object' && child.type) {
            checkForDeepEqual(child, context);
        }
    });
}

function create(context) {
    return {
        CallExpression(node) {
            // Check if this is a React.memo() or memo() call
            if (!isMemoCall(node)) {
                return;
            }

            // Check if there's a second argument (comparison function)
            if (node.arguments.length < 2) {
                return;
            }

            const comparisonFunction = node.arguments[1];

            // Only check inline function expressions or arrow functions
            // Note: We don't check variable references (e.g., memo(Component, myCompareFunc))
            // because tracking variable definitions across scopes is complex and would require
            // significant scope analysis. Users should inline their comparison functions for this
            // rule to work effectively.
            if (
                comparisonFunction.type !== 'FunctionExpression'
        && comparisonFunction.type !== 'ArrowFunctionExpression'
            ) {
                return;
            }

            // Check the body of the comparison function for deep equality checks
            checkForDeepEqual(comparisonFunction.body, context);
        },
    };
}

export {meta, create};
