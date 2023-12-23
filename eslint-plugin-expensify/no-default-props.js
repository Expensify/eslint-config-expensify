const _ = require('underscore');
const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.NO_DEFAULT_PROPS;
const {isReactViewFile} = require('./utils');

module.exports = {
    create: context => ({
        AssignmentExpression(node) {
            // Only looking at react files
            if (!isReactViewFile(context.getFilename())) {
                return;
            }

            // if the name of assignment is not defaultProps, we're good
            if (lodashGet(node, 'left.property.name') !== 'defaultProps') {
                return;
            }

            // Find all the function  in the parent node that returns a jsx element
            const parent = lodashGet(node, 'parent.type') === 'FunctionDeclaration' ? node.parent : lodashGet(node, 'parent.parent');
            const functionComponents = _.filter(parent.body, (n) => {
                if (['FunctionDeclaration', 'ExportNamedDeclaration'].indexOf(n.type) === -1) {
                    return false;
                }
                const body = n.type === 'ExportNamedDeclaration' ? lodashGet(n, 'declaration.body.body') : lodashGet(n, 'body.body');
                const isReturningJSX = _.filter(body, bodyNode => bodyNode.type === 'ReturnStatement' && lodashGet(bodyNode, 'argument.type') === 'JSXElement');
                if (_.isEmpty(isReturningJSX)) {
                    return false;
                }
                return true;
            });

            // If we don't have any function components, we're good
            if (_.isEmpty(functionComponents)) {
                return;
            }

            // Find all the function component names
            const functionComponentNames = _.map(functionComponents, (functionComponent) => {
                if (functionComponent.type === 'FunctionDeclaration') {
                    return functionComponent.id.name;
                }
                return lodashGet(functionComponent, 'declaration.id.name');
            });

            // check if the function component names includes the name of the object
            if (!_.includes(functionComponentNames, lodashGet(node, 'left.object.name'))) {
                return;
            }

            // report the error
            context.report({
                node,
                message,
            });
        },
    }),
};
