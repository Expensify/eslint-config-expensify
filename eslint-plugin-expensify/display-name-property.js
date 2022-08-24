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
            const isFunctionComponent = _.find(node.body, n => n.type === 'VariableDeclaration'
                    && _.get(n, 'declarations[0].id.name') === componentName
                    && ['FunctionExpression', 'ArrowFunctionExpression'].includes(_.get(n, 'declarations[0].init.type')));

            // Find a root level class delcaration that matches the component name
            const isClassComponent = _.find(node.body, n => n.type === 'ClassDeclaration'
                && _.get(n, 'id.name') === componentName);

            if (!isFunctionComponent && !isClassComponent) {
                return;
            }

            // Find a root level assignment expression that matches <componentName>.displayName = ...
            const hasDisplayNameProperty = _.find(node.body, bodyNode => bodyNode.type === 'ExpressionStatement'
                && _.get(bodyNode, 'expression.type', '') === 'AssignmentExpression'
                && _.get(bodyNode, 'expression.left.property.name', '') === 'displayName'
                && _.get(bodyNode, 'expression.left.object.name', '') === componentName);

            if (isFunctionComponent) {
                // Allow function components with displayName set
                if (hasDisplayNameProperty) {
                    return;
                }

                // Ignore noop components, ie. const Test = () => null;
                const component = isFunctionComponent;
                const isNoopComponent = _.get(component, 'declarations[0].init.type') === 'ArrowFunctionExpression'
                    && _.get(component, 'declarations[0].init.body.type') === 'Literal'
                    && _.get(component, 'declarations[0].init.body.value') === null;

                if (isNoopComponent) {
                    return;
                }
            }

            // Allow class components without displayName set
            if (isClassComponent && !hasDisplayNameProperty) {
                return;
            }

            // Otherwise report
            context.report({
                node,
                message: isClassComponent ? DISPLAY_NAME_PROPERTY_CLASS : DISPLAY_NAME_PROPERTY_FUNCTION,
            });
        },
    }),
};
