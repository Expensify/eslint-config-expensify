const _ = require('underscore');
const lodashGet = require('lodash/get');
const {isOnyxMethodCall, isInActionFile, isInTestFile} = require('./utils');
const message = require('./CONST').MESSAGE.PREFER_ACTIONS_SET_DATA;

/**
 * @param {String} methodName
 * @returns {Boolean}
 */
function isDataSettingMethod(methodName) {
    return _.includes(['set', 'merge', 'mergeCollection'], methodName);
}

module.exports = {
    create: context => ({
        MemberExpression(node) {
            const filename = context.getFilename();

            if (!isOnyxMethodCall(node)) {
                return;
            }

            if (isInTestFile(context.getFilename())) {
                return;
            }

            const methodName = lodashGet(node, 'property.name');
            if (!isDataSettingMethod(methodName) || isInActionFile(context.getFilename(filename))) {
                return;
            }

            context.report({
                node,
                message,
            });
        },
    }),
};
