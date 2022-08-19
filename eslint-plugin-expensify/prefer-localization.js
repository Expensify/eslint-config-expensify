const _ = require('underscore');
const {isInActionFile} = require('./utils');

const message = require('./CONST').MESSAGE.PREFER_LOCALIZATION;
const astUtil = require('./utils/astUtil');

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isDateUtilsUsedAsProperty(node) {
    const dateUtilsProperties = _.filter(node.properties, (property) => {
        const keyNode = property.key;
        const valueNode = property.value;

        if (!astUtil.isCallFromObject(keyNode, 'DateUtils')) {
            return false;
        }

        if (astUtil.getMethodName(keyNode) !== 'getMicroseconds') {
            return false;
        }

        if (astUtil.isCallFromObject(valueNode, 'Localize')) {
            return false;
        }

        return true;
    });

    return dateUtilsProperties.length;
}

module.exports = {
    create: context => ({
        ObjectExpression: (node) => {
            if (!isInActionFile(context.getFilename())) {
                return;
            }

            if (!isDateUtilsUsedAsProperty(node)) {
                return;
            }

            context.report(node, message);
        },
    }),
};
