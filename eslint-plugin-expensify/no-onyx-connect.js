import lodashGet from 'lodash/get.js';
import {isOnyxMethodCall, isInTestFile} from './utils/index.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_ONYX_CONNECT;

function create(context) {
    return {
        MemberExpression(node) {
            if (!isOnyxMethodCall(node)) {
                return;
            }

            if (isInTestFile(context.getFilename())) {
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
