const _ = require('lodash');
const aliasMap = require('./aliases');
const astUtil = require('./astUtil');

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isLodashCall(node) {
    return astUtil.isCallFromObject(node, '_');
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isChainable(node) {
    return _.includes(aliasMap.CHAINABLE_ALIASES, astUtil.getMethodName(node));
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isLodashChainStart(node) {
    return node && node.type === 'CallExpression' && (node.callee.name === '_' || (_.get(node, 'callee.object.name') === '_' && astUtil.getMethodName(node) === 'chain'));
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isLodashWrapper(node) {
    if (isLodashChainStart(node)) {
        return true;
    }
    return astUtil.isMethodCall(node) && isChainable(node) && isLodashWrapper(node.callee.object);
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isLodashWrapperMethod(node) {
    return _.includes(aliasMap.WRAPPER_METHODS, astUtil.getMethodName(node)) && node.type === 'CallExpression';
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isNativeCollectionMethodCall(node) {
    return _.includes(['every', 'filter', 'find', 'findIndex', 'each', 'map', 'reduce', 'reduceRight', 'some'], astUtil.getMethodName(node));
}

module.exports = {
    isLodashCall,
    isNativeCollectionMethodCall,
    isLodashWrapperMethod,
    isLodashWrapper,
};
