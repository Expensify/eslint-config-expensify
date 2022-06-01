const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.NO_API_SIDE_EFFECTS_METHOD;

module.exports = {
    create: context => ({
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
    }),
};
