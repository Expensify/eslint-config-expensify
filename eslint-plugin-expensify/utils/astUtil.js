import _ from 'lodash';

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

/**
 * @param {Object} objectExpression
 * @param {String} propertyName
 * @returns {Object}
 */
function findProperty(objectExpression, propertyName) {
    return _.find(
        objectExpression.properties,
        property => property.type === 'Property' && property.key.name === propertyName,
    ) || null;
}

/**
 * @param {Object} context
 * @param {String} varName
 * @param {Object} node
 * @returns {Object}
 */
function resolveVariable(context, varName, node) {
    try {
        const scope = context.sourceCode.getScope(node);
        return scope.set.get(varName)
            || (_.get(scope.upper, 'set') || new Set()).get(varName)
            || null;
    } catch {
        return null;
    }
}

/**
 * @param {Object} context
 * @param {String} varName
 * @param {Object} node
 * @returns {Object}
 */
function getVariableInit(context, varName, node) {
    const variable = resolveVariable(context, varName, node);
    if (variable && variable.defs.length > 0) {
        return variable.defs[0].node.init || null;
    }
    return null;
}

/**
 * @param {Object} context
 * @param {String} varName
 * @param {Object} node
 * @returns {Object}
 */
function getVariableAsObject(context, varName, node) {
    const init = getVariableInit(context, varName, node);
    return init && init.type === 'ObjectExpression' ? init : null;
}

export {
    getCaller,
    getMethodName,
    isMethodCall,
    isCallFromObject,
    findProperty,
    resolveVariable,
    getVariableInit,
    getVariableAsObject,
};
