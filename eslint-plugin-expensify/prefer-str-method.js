
const _ = require('underscore');
const lodashGet = require('lodash/get');

const message = require('./CONST').MESSAGE.PREFER_STR_METHOD;
const astUtil = require('./utils/astUtil');

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isUsingIncorrectStrMethod(node) {
    const strMethods = ['replaceAll'];
    const callerName = lodashGet(node, 'callee.object.name');
    if (!_.includes(strMethods, astUtil.getMethodName(node))) {
        return;
    }

    if (callerName === 'Str') {
        return;
    }

    return true;
}

module.exports = {
    create: context => ({
        CallExpression: (node) => {
            if (!isUsingIncorrectStrMethod(node)) {
                return;
            }

            context.report(node, message, {method: astUtil.getMethodName(node)});
        },
    }),
};
