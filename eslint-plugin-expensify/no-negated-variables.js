import _ from 'underscore';
import lodashGet from 'lodash/get.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_NEGATED_VARIABLES;

const BANNED_SUBSTRINGS = [
    'not',
    'isnot',
    'cannot',
    'shouldnot',
    'cant',
    'dont',
];

// Whitelisted morphemes/domain concepts that happen to contain a banned substring.
// Entries may be:
//   - Single English words (e.g. "notification") — matched loosely so natural
//     suffixes like plural "Notifications" or "Notches" still count.
//   - camelCase compounds (e.g. "notFound") — matched only when followed by a
//     word boundary (next char is uppercase/underscore/end), so we do not
//     accidentally whitelist unrelated words like "Foundation".
const NOTABLE_EXCEPTIONS = [
    'notification',
    'notify',
    'notch',
    'note',
    'notable',
    'notion',
    'notice',
    'notFound',
];

/**
 * @param {String} word
 * @returns {String}
 */
function camelToUpperSnake(word) {
    return word.replaceAll(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

/**
 * Build the list of regex alternatives that identify an occurrence of an
 * exception word inside a larger identifier. Multi-word exceptions require a
 * trailing word boundary so that they do not leak into unrelated identifiers.
 *
 * @param {String} word
 * @returns {String[]}
 */
function buildExceptionAlternatives(word) {
    const hasInternalCap = /[a-z][A-Z]/.test(word);
    const upperFirst = word[0].toUpperCase() + word.slice(1);
    const lowerFirst = word[0].toLowerCase() + word.slice(1);
    const snake = camelToUpperSnake(word);

    if (hasInternalCap) {
        return [
            `${upperFirst}(?=[A-Z_]|$)`,
            `${lowerFirst}(?=[A-Z_]|$)`,
            `_?${snake}(?=_|$)`,
        ];
    }

    return [
        upperFirst,
        lowerFirst,
        `_?${snake}_?`,
    ];
}

/**
 * @param {String} string
 * @returns {Boolean}
 */
function isFalsePositive(string) {
    const alternatives = _.flatten(_.map(NOTABLE_EXCEPTIONS, buildExceptionAlternatives));
    const regex = new RegExp(`(.*?)(?:${alternatives.join('|')})(.*)`, 'm');
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
        return false;
    }

    return _.any(BANNED_SUBSTRINGS, badSubstring => name.toLowerCase().includes(badSubstring))
        && !isFalsePositive(name);
}

function create(context) {
    return {
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
    };
}

// eslint-disable-next-line import/prefer-default-export
export {create};
