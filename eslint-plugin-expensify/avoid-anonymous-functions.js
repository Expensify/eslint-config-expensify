const message = require('./CONST').MESSAGE.AVOID_ANONYMOUS_FUNCTIONS;

module.exports = {
    create(context) {
        return {
            "CallExpression > FunctionExpression": function (node) {
                if (!node.id && !node.generator && !node.async) {
                    context.report({
                        node,
                        message,
                    });
                }
            },
            "CallExpression": function (node) {
                if (node.arguments && node.arguments.some(arg => arg.type === "ArrowFunctionExpression" && !arg.id)) {
                    context.report({
                        node,
                        message,
                    });
                }
            },
            "ReturnStatement > FunctionExpression, ReturnStatement > ArrowFunctionExpression": function(node) {
                if (!node.id) {
                    context.report({
                        node,
                        message,
                    });
                }
            }
        };
    },
};
