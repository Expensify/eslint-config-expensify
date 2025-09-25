import lodashGet from 'lodash/get.js';
import {isOnyxMethodCall, isInTestFile} from './utils/index.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.PREFER_ONYX_CONNECT_IN_LIBS;

/**
 * @param {String} filename
 * @returns {Boolean}
 */
function isInLibs(filename) {
    return filename.includes('/src/libs/');
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
            if (methodName !== 'connect' || isInLibs(filename)) {
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
