const _ = require('underscore');
const message = require('./CONST').MESSAGE.NO_MULTIPLE_API_CALLS;

module.exports = {
    create(context) {
        function checkFunctionBody(node) {
            const tokens = context.getSourceCode().getTokens(node);
            let hasCalledAPI = false;

            _.each(tokens, (token) => {
                const isAPICall = token.value === 'DeprecatedAPI' || token.value === 'API';

                if (!isAPICall) {
                    return;
                }

                if (!hasCalledAPI) {
                    hasCalledAPI = true;
                    return;
                }

                context.report({
                    node: token,
                    message,
                });
            });
        }

        return {
            FunctionDeclaration: checkFunctionBody,
            FunctionExpression: checkFunctionBody,
            ArrowFunctionExpression: checkFunctionBody,
        };
    },
};
