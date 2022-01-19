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

// Declared up front to suppress eslint no-use-before-define
// Mutually recursive functions are a valid exception to this rule. See https://github.com/eslint/eslint/issues/12473
let isNegatedVariableName;

/**
 * @param {String} string
 * @returns {Boolean}
 */
const isFalsePositive = (string) => {
    const buzzWordMatcher = new RegExp(`[nN](?:${_.map(NOTABLE_EXCEPTIONS, word => word.slice(1)).join('|')})`);
    const regex = new RegExp(`(.*)${buzzWordMatcher.source}(.*)`, 'm');
    const matches = regex.exec(string);

    if (!matches) {
        return false;
    }

    const prefix = matches[1];
    const suffix = matches[2];

    const isPrefixNegatedVariableName = isNegatedVariableName(prefix);
    const isSuffixNegatedVariableName = isNegatedVariableName(suffix);

    return !isPrefixNegatedVariableName && !isSuffixNegatedVariableName;
};

/**
 * @param {String} name
 * @returns {Boolean}
 */
isNegatedVariableName = (name) => {
    if (!name) {
        return;
    }

    return _.any(BANNED_SUBSTRINGS, badSubstring => name.toLowerCase().includes(badSubstring))
        && !isFalsePositive(name);
};

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
