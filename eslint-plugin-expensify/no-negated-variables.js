const _ = require('underscore');
const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.NO_NEGATED_VARIABLES;

/**
 *
 * @param {String} string
 * @returns {Boolean}
 */
function isFalsePositive(string) {
    return _.some(['notification', 'notch'], falsePositive => string.toLowerCase().includes(falsePositive));
}

/**
 * @param {String} name
 * @returns {Boolean}
 */
function isNegatedVariableName(name) {
    if (!name) {
        return;
    }

    return (name.includes('Not') && !isFalsePositive(name))
      || name.includes('isNot' && !isFalsePositive(name))
      || name.includes('cannot')
      || name.includes('shouldNot')
      || name.includes('cant')
      || name.includes('dont');
}

module.exports = {
    create: context => ({
        FunctionDeclaration(node) {
            const name = lodashGet(node, 'id.name');
            if (!name) {
                return;
            }

            if (!isNegatedVariableName(name)) {
                return;
            }

            context.report({
                node,
                message,
            });
        },
        VariableDeclarator(node) {
            const name = lodashGet(node, 'id.name');
            if (!name) {
                return;
            }

            if (!isNegatedVariableName(node.id.name)) {
                return;
            }

            context.report({
                node,
                message,
            });
        },
    }),
};
