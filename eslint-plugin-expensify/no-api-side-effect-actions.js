const _ = require('underscore');
const lodashGet = require('lodash/get');
const path = require('path');
const {isInActionFile} = require('./utils');
const { hasUncaughtExceptionCaptureCallback } = require('process');
const message = require('./CONST').MESSAGE.NO_API_SIDE_EFFECTS_ACTIONS;

module.exports = {
    create(context) {
        let actionsNamespaces = [];

        function hasActionCall(tokens) {
            _.each(tokens, (token) => {
                if (_.includes(actionsNamespaces, token.value)) return true
            });
            return false;
        }
        
        function hasAPICall(tokens) {
            _.each(tokens, (token) => {
                const isAPICall = token.value === 'DeprecatedAPI' || token.value === 'API';
                if (isAPICall) return true;
            });
            return false;
        }

        function checkFunctionBody(node) {
            const tokens = context.getSourceCode().getTokens(node);         
        
            if (hasAPICall(tokens) && hasActionCall(tokens)) {
                context.report({
                    body: node.body,
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
    
                actionsNamespaces.push(_.last(pathName.split('/')));
            },
            FunctionDeclaration: checkFunctionBody,
            FunctionExpression: checkFunctionBody,
            ArrowFunctionExpression: checkFunctionBody,
        };
    },
};
