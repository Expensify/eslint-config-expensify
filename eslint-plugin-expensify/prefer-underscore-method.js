/**
 * Note: This rule was adapted from eslint-plugin-underscore (https://github.com/captbaritone/eslint-plugin-underscore)
 * The main difference is that we will not warn when using any native version of includes(). This is because it's not
 * easy to tell the difference between String.includes() and Array.includes(). Underscore's includes() does not work on
 * strings so it should not be preferred unless the passed value is an array.
 */
import _ from 'underscore';
import lodashGet from 'lodash/get.js';
import CONST from './CONST.js';
import {isLodashCall, isLodashWrapper, isNativeCollectionMethodCall} from './utils/lodashUtil.js';
import {getCaller, getMethodName} from './utils/astUtil.js';

const message = CONST.MESSAGE.PREFER_UNDERSCORE_METHOD;

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
    return (callerName in staticMethods) && _.includes(staticMethods[callerName], getMethodName(node));
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isUnderscoreMethod(node) {
    return !(isLodashCall(node) || isLodashWrapper(getCaller(node)))
        && (isNativeCollectionMethodCall(node) || isStaticNativeMethodCall(node));
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

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isReactChildrenMap(node) {
    return lodashGet(node, 'callee.object.property.name') === 'Children'
        && lodashGet(node, 'callee.property.name') === 'map';
}

function create(context) {
    return {
        CallExpression: (node) => {
            if (isJestEach(node)) {
                return;
            }

            if (isReactChildrenMap(node)) {
                return;
            }

            if (!isUnderscoreMethod(node)) {
                return;
            }

            context.report(node, message, {method: getMethodName(node)});
        },
    };
}

// eslint-disable-next-line import/prefer-default-export
export {create};
