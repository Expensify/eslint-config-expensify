import _ from 'lodash';
import {CHAINABLE_ALIASES, WRAPPER_METHODS} from './aliases.js';
import {getMethodName, isCallFromObject, isMethodCall} from './astUtil.js';

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isLodashCall(node) {
    return isCallFromObject(node, '_');
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isChainable(node) {
    return _.includes(CHAINABLE_ALIASES, getMethodName(node));
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isLodashChainStart(node) {
    return node && node.type === 'CallExpression' && (node.callee.name === '_' || (_.get(node, 'callee.object.name') === '_' && getMethodName(node) === 'chain'));
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isLodashWrapper(node) {
    if (isLodashChainStart(node)) {
        return true;
    }
    return isMethodCall(node) && isChainable(node) && isLodashWrapper(node.callee.object);
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isLodashWrapperMethod(node) {
    return _.includes(WRAPPER_METHODS, getMethodName(node)) && node.type === 'CallExpression';
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isNativeCollectionMethodCall(node) {
    return _.includes(['every', 'filter', 'find', 'findIndex', 'each', 'map', 'reduce', 'reduceRight', 'some'], getMethodName(node));
}

export {
    isLodashCall,
    isNativeCollectionMethodCall,
    isLodashWrapperMethod,
    isLodashWrapper,
};
