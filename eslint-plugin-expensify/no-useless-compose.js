import lodashGet from 'lodash/get.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_USELESS_COMPOSE;

function create(context) {
    return {
        CallExpression(node) {
            const name = lodashGet(node, 'callee.name');
            if (!name) {
                return;
            }

            if (name !== 'compose') {
                return;
            }

            if (node.arguments.length !== 1) {
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
