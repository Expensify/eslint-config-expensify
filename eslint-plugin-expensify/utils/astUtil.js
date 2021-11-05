const _ = require('lodash');

/**
 * @param {Object} node
 * @returns {Object}
 */
function getCaller(node) {
    return _.get(node, 'callee.object');
}

/**
 * @param {Object} node
 * @returns {String}
 */
function getMethodName(node) {
    return _.get(node, 'callee.property.name');
}

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isMethodCall(node) {
    return node && node.type === 'CallExpression' && node.callee.type === 'MemberExpression';
}

/**
 * @param {Object} node
 * @param {String} objName
 * @returns {Boolean}
 */
function isCallFromObject(node, objName) {
    return node && node.type === 'CallExpression' && _.get(node, 'callee.object.name') === objName;
}

module.exports = {
    getCaller,
    getMethodName,
    isMethodCall,
    isCallFromObject,
};
