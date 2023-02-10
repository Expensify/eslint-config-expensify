const _ = require('underscore');
const lodashGet = require('lodash/get');
const {parse} = require('babel-eslint');
const path = require('path');
const fs = require('fs');
const {
    PROP_TYPE_REQUIRED_FALSE, PROP_TYPE_NOT_DECLARED, PROP_DEEFAULT_NOT_DECLARED, HAVE_PROP_TYPES, HAVE_DEFAULT_PROPS, ONYX_ONE_PARAM, MUST_USE_VARIABLE_FOR_ASSIGNMENT,
} = require('./CONST').MESSAGE;

module.exports = {
    create(context) {
        // Report any issues
        function makeReport(node, message, data = null) {
            context.report({
                node,
                message,
                data: {
                    key: data,
                },
            });
        }

        // Check if a list of properties has a property using spread (...) operator
        function hasSpreadOperator(node) {
            return _.find(
                node.init.properties,
                n => (lodashGet(n, 'type') === 'ExperimentalSpreadProperty' || lodashGet(n, 'type') === 'SpreadElement'),
            );
        }

        // Get the list of properties from an external file
        function getExternalProperties(sourceFile, variableNode, type) {
            const importedVariableValue = sourceFile;

            // Need to append .js since file extension is not used in imports
            const importedFile = `${path.resolve(path.dirname(context.getFilename()), importedVariableValue)}.js`;
            let importedValue;
            try {
                const raw = fs.readFileSync(importedFile);
                const ast = parse(raw.toString(), {sourceType: 'module'});
                if (type === 'ImportSpecifier') {
                    // If the import is of type - import {prop} from "./props"
                    const variableName = variableNode.defs[0].node.imported.name;
                    importedValue = _.find(
                        ast.body,
                        n => lodashGet(n, 'type') === 'VariableDeclaration'
                            && lodashGet(n, 'declarations[0].id.name') === variableName,
                    ).declarations[0].init.properties;
                } else if (type === 'ImportDefaultSpecifier') {
                    // If the import is of type - import prop from "./props"
                    importedValue = _.find(
                        ast.body,
                        n => lodashGet(n, 'type') === 'ExportDefaultDeclaration',
                    ).declaration.properties;
                }
            } catch (err) {
                // If there are any issues parsing the code to AST.
                // Can be ignored, it's impossible for the parsing to fail as long as the component code is correct
                // console.log(err);
            }
            return importedValue;
        }

        // Get the variable node from the list of variable nodes
        function getVariableNode(variables, name) {
            return _.find(
                variables,
                v => lodashGet(v, 'name') === name,
            );
        }

        // Get the node of the prop type declaration based on name
        // For example: Component.propTypes = propTypes
        function getPropsDeclaration(body, name) {
            return _.find(
                body,
                n => lodashGet(n, 'type') === 'ExpressionStatement'
                    && lodashGet(n, 'expression.left.property.name') === name,
            );
        }

        // For each property making use of spread operator, get the properties from the variable
        function getProperties(scope, propertiesVar) {
            const resolvedProps = [];
            _.each(
                _.filter(
                    propertiesVar,
                    n => (lodashGet(n, 'type') === 'ExperimentalSpreadProperty' || lodashGet(n, 'type') === 'SpreadElement'),
                ),
                (prop) => {
                    const variables = scope.variables;
                    let variableNode = getVariableNode(variables, prop.argument.name);
                    if (!variableNode) {
                        // Required in case of HOCs like withPolicy, since they might have the prop types
                        // declared outside the function, which is not in function scope
                        variableNode = getVariableNode(scope.upper.variables, prop.argument.name);
                    }

                    if (variableNode.defs[0].type === 'ImportBinding') {
                        // If the spread operator variable is imported
                        const externalProps = getExternalProperties(variableNode.defs[0].node.parent.source.value, variableNode, variableNode.defs[0].node.type);
                        resolvedProps.push(...externalProps);
                    } else {
                        // If the spread operator variable is in same file
                        const internalProps = variableNode.defs[0].node.init.properties;
                        resolvedProps.push(...internalProps);
                    }
                },
            );
            return resolvedProps;
        }

        // Get the final list of properties
        function getPropsValue(scope, propsVar) {
            const variables = scope.variables;
            let props = getVariableNode(variables, propsVar);
            if (!props) {
                // Required in case of HOCs like withPolicy, since they might have the prop types
                // declared outside the function, which is not in function scope
                props = getVariableNode(scope.upper.variables, propsVar);
            }

            if (!propsVar || !props || !lodashGet(props, 'defs[0]')) {
                return undefined;
            }

            // Need to check for existence of init since it is not present if the assignment is to an imported variable
            let propsProperties;
            if (props.defs[0].node.type === 'VariableDeclarator') {
                // If the variable is an assignment
                if (props.defs[0].node.init.type === 'ObjectExpression') {
                    // let defaultProps = {....}
                    propsProperties = props.defs[0].node.init && props.defs[0].node.init.properties;
                } else if (props.defs[0].node.init.type === 'Identifier') {
                    // let defaultProps = importedDefaultProps;
                    return getPropsValue(scope, props.defs[0].node.init.name);
                }

                if (props.defs[0].type === 'ImportBinding') {
                    propsProperties = getExternalProperties(props.defs[0].node.parent.source.value, props, props.defs[0].node.type);
                } else if (hasSpreadOperator(props.defs[0].node)) {
                    const resolvedProps = getProperties(scope, propsProperties);
                    propsProperties = propsProperties.concat(resolvedProps);
                }
            } else if (props.defs[0].node.type === 'ImportSpecifier') {
                // If the variable is a direct import
                propsProperties = getExternalProperties(props.defs[0].node.parent.source.value, props, props.defs[0].node.type);
            }

            return propsProperties;
        }

        // Report and exit if direct assignment
        // For example, Component.propType = {prop1: type1}
        function isDirectAssignment(node, declaration, key) {
            if (lodashGet(declaration, 'expression.right.type') === 'ObjectExpression') {
                makeReport(node, MUST_USE_VARIABLE_FOR_ASSIGNMENT, key);
                return true;
            }
            return false;
        }

        return {
            CallExpression(node) {
                const name = lodashGet(node, 'callee.name');
                if (!name) {
                    return;
                }

                if (name !== 'withOnyx') {
                    return;
                }

                if (node.arguments.length === 0) {
                    context.report({
                        node,
                        message: ONYX_ONE_PARAM,
                    });
                }

                // Get all the tree ancestors
                const ancestors = context.getAncestors();

                // Check the component is an HOC that wraps a component
                const wrappedComponent = _.find(
                    ancestors,
                    n => lodashGet(n, 'type') === 'ExportDefaultDeclaration'
                        && lodashGet(n, 'declaration.params[0].name') === 'WrappedComponent',
                );

                let propTypesDeclaration;
                let defaultPropTypesDeclaration;

                if (wrappedComponent) {
                    propTypesDeclaration = getPropsDeclaration(wrappedComponent.declaration.body.body, 'propTypes');
                    defaultPropTypesDeclaration = getPropsDeclaration(wrappedComponent.declaration.body.body, 'defaultProps');
                } else {
                    propTypesDeclaration = getPropsDeclaration(ancestors[0].body, 'propTypes');
                    defaultPropTypesDeclaration = getPropsDeclaration(ancestors[0].body, 'defaultProps');
                }

                if (isDirectAssignment(node, propTypesDeclaration, 'propTypes') || isDirectAssignment(node, defaultPropTypesDeclaration, 'defaultProps')) {
                    return;
                }

                const scope = context.getScope();

                // Get the assigned variable name
                const propTypesVar = lodashGet(propTypesDeclaration, 'expression.right.name');
                const defaultPropsVar = lodashGet(defaultPropTypesDeclaration, 'expression.right.name');

                // Get the list of properties
                const propTypesProperties = getPropsValue(scope, propTypesVar);
                const defaultPropsProperties = getPropsValue(scope, defaultPropsVar);

                if (!propTypesProperties) {
                    makeReport(node, HAVE_PROP_TYPES);
                    return;
                } if (!defaultPropsProperties) {
                    makeReport(node, HAVE_DEFAULT_PROPS);
                    return;
                }

                // Get the list of properties of withOnyx
                const onyxProperties = lodashGet(node, 'arguments[0].properties');

                _.each(onyxProperties, (property) => {
                    const onyxKeyName = lodashGet(property, 'key.name');
                    const declaredPropType = _.find(propTypesProperties, p => p.type === 'Property' && lodashGet(p, 'key.name') === onyxKeyName);
                    const defaultPropType = _.find(defaultPropsProperties, p => p.type === 'Property' && lodashGet(p, 'key.name') === onyxKeyName);

                    if (declaredPropType) {
                        if (lodashGet(declaredPropType, 'value.type') === 'MemberExpression') {
                            if (lodashGet(declaredPropType, 'value.property.name') === 'isRequired') {
                                makeReport(node, PROP_TYPE_REQUIRED_FALSE, onyxKeyName);
                            }
                        }
                    } else {
                        makeReport(node, PROP_TYPE_NOT_DECLARED, onyxKeyName);
                    }

                    if (!defaultPropType) {
                        makeReport(node, PROP_DEEFAULT_NOT_DECLARED, onyxKeyName);
                    }
                });
            },
        };
    },
};
