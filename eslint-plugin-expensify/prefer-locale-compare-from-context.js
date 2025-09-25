const {ESLintUtils} = require('@typescript-eslint/utils');
const lodashGet = require('lodash/get');
const {isInTestFile} = require('./utils');
const {isString} = require('./utils/typeUtil');
const message = require('./CONST').MESSAGE.PREFER_LOCALE_COMPARE_FROM_CONTEXT;

/**
 * @typedef {import('eslint').Rule.RuleModule} RuleModule
 */

function isLocaleCompareMethod(node) {
    return lodashGet(node, 'callee.type') === 'MemberExpression'
        && lodashGet(node, 'callee.property.name') === 'localeCompare';
}

/** @type {RuleModule} */
module.exports = {
    name: 'prefer-locale-compare-from-context',
    meta: {
        type: 'problem',
        docs: {
            description: message,
        },
    },
    create(context) {
        const parserServices = ESLintUtils.getParserServices(context);
        const typeChecker = parserServices.program.getTypeChecker();

        function isUsingIncorrectLocaleCompareMethod(node) {
            if (!isLocaleCompareMethod(node)) {
                return false;
            }

            const objectNode = node.callee.object;
            if (!objectNode) {
                return false;
            }

            const objectTsNode = parserServices.esTreeNodeToTSNodeMap.get(objectNode);
            const objectType = typeChecker.getTypeAtLocation(objectTsNode);
            return isString(objectType);
        }

        return {
            CallExpression(node) {
                if (isInTestFile(context.filename)) {
                    return;
                }

                if (!isUsingIncorrectLocaleCompareMethod(node)) {
                    return;
                }

                context.report({
                    node,
                    message,
                });
            },
        };
    },
};
