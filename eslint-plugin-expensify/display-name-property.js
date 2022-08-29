const _ = require('lodash');
const {isReactViewFile} = require('./utils');
const {DISPLAY_NAME_PROPERTY_CLASS, DISPLAY_NAME_PROPERTY_FUNCTION} = require('./CONST').MESSAGE;

module.exports = {
    create: context => ({
        Program(node) {
            // Only looking at react files
            if (!isReactViewFile(context.getFilename())) {
                return;
            }

            // Infer the component name from the filename
            const filenameParts = _.split(context.getFilename(), '/');
            let componentName = _(filenameParts).last().split('.')[0];
            if (componentName === 'index') {
                componentName = filenameParts[filenameParts.length - 2];
            }

            // Find a root level variable delcaration that matches the component name
            const functionComponent = _.find(node.body, n => n.type === 'VariableDeclaration'
                    && _.get(n, 'declarations[0].id.name') === componentName
                    && ['FunctionExpression', 'ArrowFunctionExpression'].includes(_.get(n, 'declarations[0].init.type')));

            // Find a root level class delcaration that matches the component name
            const classComponent = _.find(node.body, n => n.type === 'ClassDeclaration'
                && _.get(n, 'id.name') === componentName);

            if (_.isUndefined(functionComponent) && _.isUndefined(classComponent)) {
                return;
            }

            // Find a root level assignment expression that matches <componentName>.displayName = ...
            const displayNameAssignment = _.find(node.body, bodyNode => bodyNode.type === 'ExpressionStatement'
                && _.get(bodyNode, 'expression.type', '') === 'AssignmentExpression'
                && _.get(bodyNode, 'expression.left.property.name', '') === 'displayName'
                && _.get(bodyNode, 'expression.left.object.name', '') === componentName);

            // Allow class components without displayName set
            if (!_.isUndefined(classComponent) && _.isUndefined(displayNameAssignment)) {
                return;
            }

            // Allow function components with displayName set
            if (!_.isUndefined(functionComponent) && !_.isUndefined(displayNameAssignment)) {
                return;
            }

            const isNoopComponent = _.get(functionComponent, 'declarations[0].init.type') === 'ArrowFunctionExpression'
                && _.get(functionComponent, 'declarations[0].init.body.type') === 'Literal'
                && _.get(functionComponent, 'declarations[0].init.body.value') === null;

            // Ignore noop components, ie. const Test = () => null;
            if (isNoopComponent) {
                return;
            }

            // Otherwise report
            context.report({
                node,
                message: classComponent ? DISPLAY_NAME_PROPERTY_CLASS : DISPLAY_NAME_PROPERTY_FUNCTION,
            });
        },
    }),
};
