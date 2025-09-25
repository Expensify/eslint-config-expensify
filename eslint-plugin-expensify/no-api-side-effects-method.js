import lodashGet from 'lodash/get.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_API_SIDE_EFFECTS_METHOD;

function create(context) {
    return {
        CallExpression(node) {
            const name = lodashGet(node, 'callee.property.name');
            if (!name) {
                return;
            }

            if (name !== 'makeRequestWithSideEffects') {
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
