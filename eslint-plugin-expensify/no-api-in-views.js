import {isInActionFile, isInTestFile} from './utils/index.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_API_IN_VIEWS;

function create(context) {
    const filename = context.getFilename();
    if (isInActionFile(filename) || isInTestFile(filename)) {
        return {};
    }

    return {
        Identifier(node) {
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
