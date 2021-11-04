/**
 * Note: This rule was adapted from eslint-plugin-underscore (https://github.com/captbaritone/eslint-plugin-underscore)
 * The main difference is that we will not warn when using any native version of includes(). This is because it's not
 * easy to tell the difference between String.includes() and Array.includes(). Underscore's includes() does not work on
 * strings so it should not be preferred unless the passed value is an array.
 */
const _ = require('underscore');
const lodashGet = require('lodash/get');

const message = require('./CONST').MESSAGE.PREFER_UNDERSCORE_METHOD;
const lodashUtil = require('./utils/lodashUtil');
const astUtil = require('./utils/astUtil');

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isStaticNativeMethodCall(node) {
    const staticMethods = {
        Object: ['assign', 'create', 'keys', 'values'],
        Array: ['isArray'],
    };
    const callerName = lodashGet(node, 'callee.object.name');
    return (callerName in staticMethods) && _.includes(staticMethods[callerName], astUtil.getMethodName(node));
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isUnderscoreMethod(node) {
    return !(lodashUtil.isLodashCall(node) || lodashUtil.isLodashWrapper(astUtil.getCaller(node)))
        && (lodashUtil.isNativeCollectionMethodCall(node) || isStaticNativeMethodCall(node));
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isJestEach(node) {
    const objectName = lodashGet(node, 'callee.object.name');
    return (objectName === 'test' || objectName === 'describe')
        && lodashGet(node, 'callee.property.name') === 'each';
}

module.exports = {
    create: context => ({
        CallExpression: (node) => {
            if (isJestEach(node)) {
                return;
            }

            if (!isUnderscoreMethod(node)) {
                return;
            }

            context.report(node, message, {method: astUtil.getMethodName(node)});
        },
    }),
};
