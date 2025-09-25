import _ from 'underscore';
import {isInActionFile} from './utils/index.js';
import CONST from './CONST.js';
import {getMethodName, isCallFromObject} from './utils/astUtil.js';

const message = CONST.MESSAGE.PREFER_LOCALIZATION;

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isDateUtilsUsedAsProperty(node) {
    const dateUtilsProperties = _.filter(node.properties, (property) => {
        const keyNode = property.key;
        const valueNode = property.value;

        if (!isCallFromObject(keyNode, 'DateUtils')) {
            return false;
        }

        if (getMethodName(keyNode) !== 'getMicroseconds') {
            return false;
        }

        if (isCallFromObject(valueNode, 'Localize')) {
            return false;
        }

        return true;
    });

    return dateUtilsProperties.length > 0;
}

function create(context) {
    return {
        ObjectExpression: (node) => {
            if (!isInActionFile(context.getFilename())) {
                return;
            }

            if (!isDateUtilsUsedAsProperty(node)) {
                return;
            }

            context.report(node, message);
        },
    };
}

// eslint-disable-next-line import/prefer-default-export
export {create};
