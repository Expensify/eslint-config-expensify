import {isInActionFile, isInTestFile} from './utils/index.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_API_IN_VIEWS;

function create(context) {
    return {
        Identifier(node) {
            if (isInActionFile(context.getFilename())) {
                return;
            }

            if (isInTestFile(context.getFilename())) {
                return;
            }

            if (node.name !== 'API' && node.name !== 'DeprecatedAPI') {
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
