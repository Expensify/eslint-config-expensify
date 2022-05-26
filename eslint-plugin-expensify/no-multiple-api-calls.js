const {isInActionFile} = require('./utils');
const message = require('./CONST').MESSAGE.NO_MULTIPLE_API_CALLS;

module.exports = {
    create(context) {
        function checkFunctionBody(node) {
            // This rule is scoped to the ./actions/ directory because we already have a rule
            // preventing any API calls outside of actions.
            if (!isInActionFile(context.getFilename())) {
                return;
            }

            const tokens = context.getSourceCode().getTokens(node);
            let hasCalledAPI = false;

            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                const isAPICall = token.value === 'deprecatedAPI' || token.value === 'API';

                if (isAPICall && hasCalledAPI) {
                    context.report({
                        node: token,
                        message,
                    });
                }

                if (isAPICall && !hasCalledAPI) {
                    hasCalledAPI = true;
                }
            }
        }

        return {
            FunctionDeclaration: checkFunctionBody,
            FunctionExpression: checkFunctionBody,
            ArrowFunctionExpression: checkFunctionBody,
        };
    },
};
