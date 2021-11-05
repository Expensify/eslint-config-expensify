const {isInActionFile, isInTestFile} = require('./utils');
const message = require('./CONST').MESSAGE.NO_API_IN_VIEWS;

module.exports = {
    create: context => ({
        Identifier(node) {
            if (isInActionFile(context.getFilename())) {
                return;
            }

            if (isInTestFile(context.getFilename())) {
                return;
            }

            if (node.name !== 'API') {
                return;
            }

            context.report({
                node,
                message,
            });
        },
    }),
};
