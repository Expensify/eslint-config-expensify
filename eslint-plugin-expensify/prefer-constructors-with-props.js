const message = require('./CONST').MESSAGE.PREFER_CONSTRUCTORS_WITH_PROPS;

module.exports = {
    create: context => ({
        FunctionExpression(node) {
            // Destructure the node and get these useful properties
            const {
                parent,
                params,
                body,
            } = node;

            // Anonymous function to check if there's a props parameter
            const hasPropsParameter = ({
                name,
                type,
            }) => name === 'props' && type === 'Identifier';

            // Anonymous function to check if there's a super call
            const hasSuperCall = ({
                type,
                expression,
            }) => type === 'ExpressionStatement'
                && expression.type === 'CallExpression'
                && expression.callee.type === 'Super'
                && expression.arguments.some(hasPropsParameter);

            if (parent.kind === 'constructor') {
                // Check if the constructor has a parameter called 'props', return if not
                if (!params.some(hasPropsParameter)) {
                    context.report({
                        node,
                        message,
                    });
                    return;
                }

                // Check if the constructor has a super call with any parameter called 'props'
                if (!body.body.some(hasSuperCall)) {
                    context.report({
                        node,
                        message,
                    });
                }
            }
        },
    }),
};
