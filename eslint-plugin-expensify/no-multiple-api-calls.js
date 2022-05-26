const message = require('./CONST').MESSAGE.NO_MULTIPLE_API_CALLS;

module.exports = {
    create(context) {
        let count = 0;
        function checkFunctionBody(node) {
            if (node.name === 'deprecatedAPI' || node.name === 'API') {
                count++;
                if (count > 1) {
                    context.report({
                        node,
                        message,
                    });
                }
            }
        }

        return {
            "FunctionDeclaration CallExpression Identifier": checkFunctionBody,
            "FunctionExpression CallExpression Identifier": checkFunctionBody,
            "ArrowFunctionExpression CallExpression Identifier": checkFunctionBody,
        };
    },
};
