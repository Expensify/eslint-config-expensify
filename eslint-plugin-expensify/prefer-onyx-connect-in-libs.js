const lodashGet = require('lodash/get');
const {isOnyxMethodCall, isInTestFile} = require('./utils');

const message = require('./CONST').MESSAGE.PREFER_ONYX_CONNECT_IN_LIBS;

/**
 * @param {String} filename
 * @returns {Boolean}
 */
function isInLibs(filename) {
    return filename.includes('/src/libs/');
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
            if (methodName !== 'connect' || isInLibs(filename)) {
                return;
            }

            context.report({
                node,
                message,
            });
        },
    }),
};
