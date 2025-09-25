import _ from 'underscore';
import lodashGet from 'lodash/get.js';
import {isOnyxMethodCall, isInActionFile, isInTestFile} from './utils/index.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.PREFER_ACTIONS_SET_DATA;

/**
 * @param {String} methodName
 * @returns {Boolean}
 */
function isDataSettingMethod(methodName) {
    return _.includes(['set', 'merge', 'mergeCollection'], methodName);
}

function create(context) {
    return {
        MemberExpression(node) {
            const filename = context.getFilename();

            if (!isOnyxMethodCall(node)) {
                return;
            }

            if (isInTestFile(context.getFilename())) {
                return;
            }

            const methodName = lodashGet(node, 'property.name');
            if (!isDataSettingMethod(methodName) || isInActionFile(context.getFilename(filename))) {
                return;
            }

            context.report({
                node,
                message,
            });
        },
    };
}

// eslint-disable-next-line import/prefer-default-export
export {create};
