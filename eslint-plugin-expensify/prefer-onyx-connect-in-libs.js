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
    const filename = context.getFilename();
    if (isInTestFile(filename) || isInLibs(filename)) {
        return {};
    }

    return {
        MemberExpression(node) {
            if (!isOnyxMethodCall(node)) {
                return;
            }

            const methodName = lodashGet(node, 'property.name');
            if (methodName !== 'connect') {
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
