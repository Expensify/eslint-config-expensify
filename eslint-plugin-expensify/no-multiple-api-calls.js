import _ from 'underscore';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_MULTIPLE_API_CALLS;

function create(context) {
    function checkFunctionBody(node) {
        const tokens = context.getSourceCode().getTokens(node);
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
