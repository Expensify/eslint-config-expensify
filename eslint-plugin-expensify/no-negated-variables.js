const _ = require('underscore');
const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.NO_NEGATED_VARIABLES;

const NOTABLE_EXCEPTIONS = [
    'notification',
    'notch',
    'note',
    'notable',
    'notion',
    'notice',
];

/**
 * @param {String} string
 * @returns {Boolean}
 */
function isFalsePositive(string) {
    const buzzWordMatcher = new RegExp(`[nN](?:${_.map(NOTABLE_EXCEPTIONS, word => word.slice(1)).join('|')})`);
    const regex = new RegExp(`(.*?)(?:${buzzWordMatcher.source})+(.*)`, 'gm');
    const matches = regex.exec(string);

    if (!matches) {
        return false;
    }

    const prefix = matches[1];
    const suffix = matches[2];

    if (_.some([prefix, suffix], s => /.*[nN](?:ot).*/.test(s) && !buzzWordMatcher.test(s))) {
        return false;
    }

    return true;
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
