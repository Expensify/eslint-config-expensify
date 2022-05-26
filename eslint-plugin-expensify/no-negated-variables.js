const _ = require('underscore');
const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.NO_NEGATED_VARIABLES;

const BANNED_SUBSTRINGS = [
    'not',
    'isnot',
    'cannot',
    'shouldnot',
    'cant',
    'dont',
];

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
    const upperSnakeCaseMatcher = new RegExp(`_?${_.map(NOTABLE_EXCEPTIONS, word => word.toUpperCase()).join('|')}_?`);
    const regex = new RegExp(`(.*)(?:${buzzWordMatcher.source}|${upperSnakeCaseMatcher.source})(.*)`, 'm');
    const matches = regex.exec(string);

    if (!matches) {
        return false;
    }

    const prefix = matches[1];
    const suffix = matches[2];

    // eslint-disable-next-line no-use-before-define
    const isPrefixNegatedVariableName = isNegatedVariableName(prefix);
    // eslint-disable-next-line no-use-before-define
    const isSuffixNegatedVariableName = isNegatedVariableName(suffix);

    return !isPrefixNegatedVariableName && !isSuffixNegatedVariableName;
}

/**
 * @param {String} name
 * @returns {Boolean}
 */
function isNegatedVariableName(name) {
    if (!name) {
        return;
    }

    return _.any(BANNED_SUBSTRINGS, badSubstring => name.toLowerCase().includes(badSubstring))
        && !isFalsePositive(name);
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
