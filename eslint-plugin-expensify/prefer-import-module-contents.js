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

module.exports = {
    create: context => ({
        ImportDeclaration(node) {
            const sourceValue = lodashGet(node, 'source.value');
            if (!sourceValue) {
                return;
            }

            if (isFromNodeModules(sourceValue)) {
                return;
            }

            if (!node.specifiers || !node.specifiers.length) {
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
