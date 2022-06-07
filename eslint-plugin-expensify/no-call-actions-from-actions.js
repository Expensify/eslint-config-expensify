const _ = require('underscore');
const lodashGet = require('lodash/get');
const path = require('path');
const {isInActionFile} = require('./utils');
const message = require('./CONST').MESSAGE.NO_CALL_ACTIONS_FROM_ACTIONS;

module.exports = {
    create(context) {
        let actions = [];

        function hasActionCall(tokens) {
            return _.find(tokens, (token) => {
                return _.includes(actions, token.value);
            });
        }
        
        function hasAPICall(tokens) {
            return _.find(tokens, (token) => {
                return token.value === 'API';
            });
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
            ImportDeclaration: function(node) {
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
    },
};
