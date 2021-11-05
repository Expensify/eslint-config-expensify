const message = require('./CONST').MESSAGE.NO_INLINE_NAMED_EXPORT;

module.exports = {
    create: context => ({
        ExportNamedDeclaration(node) {
            if (!node.declaration) {
                return;
            }

            context.report({
                node,
                message,
            });
        },
    }),
};
