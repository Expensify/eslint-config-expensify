const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.PREFER_TOKENIZED_SEARCH;

/**
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

    const filterBody = callback.body;

    if (lodashGet(filterBody, 'callee.property.name') !== 'includes') {
        return false;
    }

    const lowerCaseCall = lodashGet(filterBody, 'callee.object');

    if (
        lodashGet(lowerCaseCall, 'callee.property.name') === 'toLowerCase' ||
        lodashGet(lowerCaseCall, 'callee.object.callee.property.name') === 'toLowerCase'
    ) {
        return true;
    }

    return false;
}

module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Enforce the use of tokenized search instead of direct string includes',
        },
        schema: []
    },
    create: context => ({
        CallExpression: (node) => {
            if (!isUsingFilterIncludes(node)) {
                return;
            }

            context.report({ node, message });
        },
    }),
};