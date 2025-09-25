import _ from 'underscore';
import lodashGet from 'lodash/get.js';
import CONST from './CONST.js';
import {getMethodName} from './utils/astUtil.js';

const message = CONST.MESSAGE.PREFER_STR_METHOD;

/**
 * @param {Object} node
 * @returns {Boolean}
 */
function isUsingIncorrectStrMethod(node) {
    const strMethods = ['replaceAll'];
    const callerName = lodashGet(node, 'callee.object.name');
    if (!_.includes(strMethods, getMethodName(node))) {
        return false;
    }

    if (callerName === 'Str') {
        return false;
    }

    return true;
}

function create(context) {
    return {
        CallExpression: (node) => {
            if (!isUsingIncorrectStrMethod(node)) {
                return;
            }

            context.report(node, message, {method: getMethodName(node)});
        },
    };
}

// eslint-disable-next-line import/prefer-default-export
export {create};
