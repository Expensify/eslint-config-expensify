import _ from 'underscore';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_MULTIPLE_API_CALLS;

function create(context) {
    const sourceCode = context.getSourceCode();

    function checkFunctionBody(node) {
        const functionText = sourceCode.text.slice(node.range[0], node.range[1]);

        // Identifiers can spell API with Unicode escapes, which tokenization resolves.
        if (functionText.indexOf('API') === -1 && functionText.indexOf('\\u') === -1) {
            return;
        }

        const tokens = sourceCode.getTokens(node);
        let hasCalledAPI = false;

        _.each(tokens, (token) => {
            const isAPICall = token.value === 'API';

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
}

// eslint-disable-next-line import/prefer-default-export
export {create};
