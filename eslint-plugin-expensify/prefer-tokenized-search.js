const lodashGet = require('lodash/get');
const lodashSome = require('lodash/some');
const lodashIsArray = require('lodash/isArray');
const lodashIsObject = require('lodash/isObject');
const lodashFilter = require('lodash/filter');
const lodashEntries = require('lodash/entries');
const message = require('./CONST').MESSAGE.PREFER_TOKENIZED_SEARCH;

/**
 * Unwraps a ChainExpression if present.
 * @param {Object} node
 * @returns {Object}
 */
function extractCallExpression(node) {
    return node && node.type === 'ChainExpression' ? node.expression : node;
}

/**
 * Recursively checks if a node contains a call to toLowerCase.
 * Skips the 'parent' property to avoid circular references.
 * @param {Object} node
 * @returns {Boolean}
 */
function containsToLowerCase(node) {
    if (!node || typeof node !== 'object') { return false; }

    if (node.type === 'CallExpression') {
        const callExp = extractCallExpression(node);
        if (lodashGet(callExp, 'callee.property.name') === 'toLowerCase') {
            return true;
        }
    }

    return lodashSome(Object.entries(node), ([key, child]) => {
        if (key === 'parent') { return false; }

        if (lodashIsArray(child)) {
            return lodashSome(child, c => containsToLowerCase(c));
        }

        return child && typeof child === 'object' && containsToLowerCase(child);
    });
}

/**
 * Checks if a given call expression is suspicious:
 *   - It calls "includes" on something that, somewhere in its chain,
 *     calls toLowerCase.
 * @param {Object} expr
 * @returns {Boolean}
 */
function checkExpression(expr) {
    if (!expr) {
        return false;
    }

    // If the expression is a call expression, check if it's an includes call.
    if (expr.type === 'CallExpression') {
        const callExp = extractCallExpression(expr);
        if (lodashGet(callExp, 'callee.property.name') === 'includes') {
            const lowerCaseCall = lodashGet(callExp, 'callee.object');
            if (containsToLowerCase(lowerCaseCall)) {
                return true;
            }
        }
    }

    // If the expression is a logical expression (e.g. using ||), check both sides.
    if (expr.type === 'LogicalExpression') {
        return checkExpression(expr.left) || checkExpression(expr.right);
    }
    return false;
}

/**
 * Recursively traverses a node's AST to find any suspicious call expression.
 * Skips properties named 'parent' to avoid circular references.
 * @param {Object} node
 * @returns {Boolean}
 */
function findSuspiciousCall(node) {
    if (!node || !lodashIsObject(node)) { return false; }

    if (node.type === 'CallExpression' && checkExpression(node)) {
        return true;
    }

    const entries = lodashFilter(lodashEntries(node), ([key]) => key !== 'parent');

    return lodashSome(entries, ([, child]) => {
        if (lodashIsArray(child)) {
            return lodashSome(child, c => findSuspiciousCall(c));
        }
        return lodashIsObject(child) && findSuspiciousCall(child);
    });
}

/**
 * Determines if the given CallExpression node is a filter call
 * that uses includes on a lowercased value.
 * @param {Object} node
 * @returns {Boolean}
 */
function isUsingFilterIncludes(node) {
    if (lodashGet(node, 'callee.property.name') !== 'filter') {
        return false;
    }

    const callback = lodashGet(node, 'arguments[0]');
    if (!callback || callback.type !== 'ArrowFunctionExpression') {
        return false;
    }

    // For expression-bodied arrow functions.
    if (callback.body.type !== 'BlockStatement') {
        const expr = extractCallExpression(callback.body);
        return checkExpression(expr);
    }

    // For block-bodied arrow functions, recursively search the entire body.
    return findSuspiciousCall(callback.body);
}

module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Enforce the use of tokenized search instead of direct string includes',
        },
        schema: [],
    },
    create: context => ({
        CallExpression: (node) => {
            if (!isUsingFilterIncludes(node)) {
                return;
            }

            context.report({node, message});
        },
    }),
};
