const lodashGet = require('lodash/get');
const {isOnyxMethodCall, isInTestFile} = require('./utils');

const message = require('./CONST').MESSAGE.NO_ONYX_CONNECT;

module.exports = {
    create: context => ({
        MemberExpression(node) {
            if (!isOnyxMethodCall(node)) {
                return;
            }

            if (isInTestFile(context.getFilename())) {
                return;
            }

            const methodName = lodashGet(node, 'property.name');
            if (methodName !== 'connect') {
                return;
            }

            context.report({
                node,
                message,
            });
        },
    }),
};
