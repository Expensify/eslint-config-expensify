const _ = require('underscore');
const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.PREFER_IMPORT_MODULE_CONTENTS;

/**
 * @param {String} source
 * @returns {Boolean}
 */
function isFromNodeModules(source) {
    return !source.startsWith('.') && !source.startsWith('..');
}

/**
 * @param {Array} specifiers
 * @returns {Boolean}
 */
function isEverySpecifierImport(specifiers = []) {
    return _.every(specifiers, specifier => specifier.type === 'ImportSpecifier');
}

/**
 * Make an exception for propTypes since they are sometimes bundled with modules.
 *
 * @param {Array} specifiers
 * @returns {Boolean}
 */
function hasPropTypesSpecifier(specifiers) {
    return _.some(specifiers, specifier => /proptypes/.test(lodashGet(specifier, 'imported.name', '').toLowerCase()));
}

/**
 * @param {String} source
 * @returns {Boolean}
 */
function isHigherOrderComponent(source) {
    return /with/.test(source.toLowerCase());
}

/**
 * @param {String} source
 * @returns {Boolean}
 */
function isContextComponent(source) {
    return /context|provider/.test(source.toLowerCase());
}

/**
 * @param {String} source
 * @returns {Boolean}
 */
function isJSONFile(source) {
    return /\.json/.test(source.toLowerCase());
}

module.exports = {
    create: context => ({
        ImportDeclaration(node) {
            const sourceValue = lodashGet(node, 'source.value');
            if (!sourceValue) {
                return;
            }

            if (isFromNodeModules(sourceValue)
                || isHigherOrderComponent(sourceValue)
                || isContextComponent(sourceValue)
                || isJSONFile(sourceValue)
            ) {
                return;
            }

            if (!node.specifiers || !node.specifiers.length) {
                return;
            }

            if (hasPropTypesSpecifier(node.specifiers)) {
                return;
            }

            if (!isEverySpecifierImport(node.specifiers)) {
                return;
            }

            context.report({
                node,
                message,
            });
        },
    }),
};
