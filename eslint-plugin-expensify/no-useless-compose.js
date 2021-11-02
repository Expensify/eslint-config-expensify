const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.NO_USELESS_COMPOSE;

module.exports = {
    create: context => ({
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
    }),
};
