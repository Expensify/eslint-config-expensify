import _ from 'underscore';
import lodashGet from 'lodash/get.js';
import path from 'path';
import {isInActionFile} from './utils/index.js';
import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_CALL_ACTIONS_FROM_ACTIONS;

function create(context) {
    const actions = [];

    function hasActionCall(tokens) {
        return _.find(tokens, token => _.includes(actions, token.value));
    }

    function hasAPICall(tokens) {
        return _.find(tokens, token => token.value === 'API');
    }

    function checkFunctionBody(node) {
        if (!isInActionFile(context.getFilename())) {
            return;
        }

        const tokens = context.getSourceCode().getTokens(node);

        if (hasAPICall(tokens) && hasActionCall(tokens)) {
            context.report({
                node,
                message,
            });
        }
    }

    return {
        ImportDeclaration(node) {
            const pathName = path.resolve(lodashGet(node, 'source.value'));
            if (!pathName || !pathName.includes('/actions/')) {
                return;
            }

            const filename = _.last(pathName.split('/'));
            actions.push(_.first(filename.split('.')));
        },
        FunctionDeclaration: checkFunctionBody,
        FunctionExpression: checkFunctionBody,
        ArrowFunctionExpression: checkFunctionBody,
    };
}

// eslint-disable-next-line import/prefer-default-export
export {create};
