import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_INLINE_NAMED_EXPORT;

function create(context) {
    return {
        ExportNamedDeclaration(node) {
            if (!node.declaration) {
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
