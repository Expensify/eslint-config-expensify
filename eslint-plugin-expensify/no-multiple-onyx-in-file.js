import lodashGet from 'lodash/get.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_MULTIPLE_ONYX_IN_FILE;

function create(context) {
    let withOnyxCount = 0;

    return {
        CallExpression(node) {
            const calleeName = lodashGet(node, 'callee.name');

            if (calleeName === 'withOnyx') {
                withOnyxCount += 1;

                if (withOnyxCount > 1) {
                    context.report({
                        node,
                        message,
                    });
                }
            }
        },
        'Program:exit': () => {
            withOnyxCount = 0;
        },
    };
}

// eslint-disable-next-line import/prefer-default-export
export {create};
