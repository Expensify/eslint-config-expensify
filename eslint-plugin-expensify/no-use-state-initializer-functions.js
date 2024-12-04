const message = require('./CONST').MESSAGE.NO_USE_STATE_INITIALIZER_CALL_FUNCTION;

module.exports = {
    meta: {
        type: 'problem', // This is a potential performance issue
        docs: {
            description:
                'Disallow direct function calls in useState initializer',
            category: 'Best Practices',
            recommended: false,
        },
        schema: [], // No options for this rule
        messages: {
            noDirectCall: message,
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                // Return early if the function being called is not `useState`
                if (
                    node.callee.type !== 'Identifier'
                    || node.callee.name !== 'useState'
                    || node.arguments.length === 0
                ) {
                    return;
                }

                const firstArg = node.arguments[0];

                // Return early if the first argument is not a function call, member expression with a function call, or conditional expression with function calls
                if (
                    firstArg.type !== 'CallExpression'
                    && !(firstArg.type === 'MemberExpression' && firstArg.object.type === 'CallExpression')
                    && !(firstArg.type === 'ConditionalExpression'
                        && (firstArg.consequent.type === 'CallExpression' || firstArg.alternate.type === 'CallExpression'))
                ) {
                    return;
                }

                context.report({
                    node: firstArg,
                    messageId: 'noDirectCall',
                });
            },

            // Handle cases where the initializer is passed as a function reference
            VariableDeclarator(node) {
                if (
                    !node.init
                    || node.init.type !== 'CallExpression'
                    || node.init.callee.name !== 'useState'
                    || node.init.arguments.length === 0
                ) {
                    return;
                }

                const firstArg = node.init.arguments[0];

                // Return early if the first argument is a function reference (valid case)
                if (
                    firstArg.type === 'Identifier' // e.g., `getChatTabBrickRoad`
                    || (firstArg.type === 'ArrowFunctionExpression'
                        && firstArg.body.type !== 'CallExpression') // e.g., `() => getChatTabBrickRoad`
                ) {
                    return; // Valid case, do nothing
                }

                // If it's a direct function call, member expression with a function call, or conditional expression with function calls, report it
                if (
                    firstArg.type === 'CallExpression'
                    || (firstArg.type === 'MemberExpression' && firstArg.object.type === 'CallExpression')
                    || (firstArg.type === 'ConditionalExpression'
                        && (firstArg.consequent.type === 'CallExpression' || firstArg.alternate.type === 'CallExpression'))
                ) {
                    context.report({
                        node: firstArg,
                        messageId: 'noDirectCall',
                    });
                }
            },
        };
    },
};
