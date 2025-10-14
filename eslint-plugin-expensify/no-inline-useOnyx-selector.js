import _ from 'underscore';

const meta = {
    type: 'problem',
    docs: {
        description: 'Enforces that useOnyx hook calls do not use inline selectors.',
        recommended: 'error',
    },
    schema: [],
    messages: {
        noInlineSelector: 'useOnyx() selector should not be defined inline.\n\n'
            + 'Shared selectors: define in a dedicated selectors/ directory for reuse.\n\n'
            + 'Local selectors: define in the same file outside the component.\n\n'
            + 'Contextual selectors: define as useCallback inside the component with relevant dependencies.',
        noNonMemoizedSelector: 'useOnyx() selector defined within component should be memoized with useCallback.\n\n'
            + 'Wrap the selector function with useCallback to prevent unnecessary re-renders:\n\n'
            + 'const memoizedSelector = useCallback((val) => ({...}), [dependencies]);',
    },
};

function create(context) {
    const componentStack = [];

    /**
     * Check if a function node appears to be a React component.
     *
     * @param {Function} node - The function node to check.
     * @returns {boolean}
     */
    function isReactComponent(node) {
        if (node.type === 'FunctionDeclaration' && node.id) {
            return /^[A-Z]/.test(node.id.name);
        }

        if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
            const parent = node.parent;
            if (parent && parent.type === 'VariableDeclarator' && parent.id && parent.id.name) {
                return /^[A-Z]/.test(parent.id.name);
            }
        }

        return false;
    }

    /**
     * Check if a variable is defined with useCallback.
     *
     * @param {Variable} variable - The variable to check.
     * @returns {boolean}
     */
    function isDefinedWithUseCallback(variable) {
        if (!variable || variable.defs.length === 0) {
            return false;
        }

        const def = variable.defs[0];
        if (def.node.init && def.node.init.type === 'CallExpression') {
            const callee = def.node.init.callee;
            return callee.name === 'useCallback';
        }

        return false;
    }

    /**
     * Check if a variable is defined within the current component scope.
     *
     * @param {Variable} variable - The variable to check.
     * @returns {boolean}
     */
    function isDefinedInCurrentComponent(variable) {
        if (!variable || variable.defs.length === 0 || componentStack.length === 0) {
            return false;
        }

        const currentComponent = componentStack[componentStack.length - 1];
        const variableDef = variable.defs[0];

        // Check if the variable is defined within the current component's body
        return (
            variableDef.node.range[0] >= currentComponent.body.range[0]
            && variableDef.node.range[1] <= currentComponent.body.range[1]
        );
    }

    /**
     * Find the variable declaration and return the value.
     *
     * @param {string} name - The name of the variable to resolve.
     * @param {Node} node - The node to get scope from.
     * @returns {ObjectExpression|null}
     */
    function getVariableValue(name, node) {
        try {
            const scope = context.sourceCode.getScope(node);
            const variable = scope.set.get(name) || scope.upper?.set.get(name);

            if (variable && variable.defs.length > 0) {
                const def = variable.defs[0];
                if (def.node.init && def.node.init.type === 'ObjectExpression') {
                    return def.node.init;
                }
            }
        } catch (e) {
            return null;
        }

        return null;
    }

    /**
     * Check if a property is a selector property with an inline function.
     *
     * @param {Property} property - The property to check.
     * @returns {boolean}
     */
    function isInlineSelector(property) {
        return (
            property.type === 'Property'
            && property.key.name === 'selector'
            && (property.value.type === 'FunctionExpression' || property.value.type === 'ArrowFunctionExpression')
        );
    }

    /**
     * Check if an object has an inline selector property.
     *
     * @param {ObjectExpression} objectExpression - The object to check.
     * @returns {boolean}
     */
    function hasInlineSelector(objectExpression) {
        return _.some(objectExpression.properties, isInlineSelector);
    }

    /**
     * Find selector property in an object expression.
     *
     * @param {ObjectExpression} objectExpression - The object to search.
     * @returns {Property|null}
     */
    function findSelectorProperty(objectExpression) {
        return _.find(objectExpression.properties, property => property.type === 'Property' && property.key.name === 'selector') || null;
    }

    /**
     * Check if a selector identifier should be memoized within component.
     *
     * @param {string} selectorName - The name of the selector identifier.
     * @param {Node} node - The useOnyx call node.
     */
    function checkSelectorMemoization(selectorName, node) {
        if (componentStack.length === 0) {
            return; // Not inside a component
        }

        const scope = context.sourceCode.getScope(node);
        const variable = scope.set.get(selectorName) || scope.upper?.set.get(selectorName);

        if (!variable) {
            return; // Variable not found in current scope
        }

        if (isDefinedInCurrentComponent(variable) && !isDefinedWithUseCallback(variable)) {
            context.report({
                node,
                messageId: 'noNonMemoizedSelector',
            });
        }
    }

    return {
        FunctionDeclaration(node) {
            if (!isReactComponent(node)) {
                return;
            }
            componentStack.push(node);
        },
        'FunctionDeclaration:exit': function (node) {
            if (!isReactComponent(node)) {
                return;
            }
            componentStack.pop();
        },
        FunctionExpression(node) {
            if (!isReactComponent(node)) {
                return;
            }
            componentStack.push(node);
        },
        'FunctionExpression:exit': function (node) {
            if (!isReactComponent(node)) {
                return;
            }
            componentStack.pop();
        },
        ArrowFunctionExpression(node) {
            if (!isReactComponent(node)) {
                return;
            }
            componentStack.push(node);
        },
        'ArrowFunctionExpression:exit': function (node) {
            if (!isReactComponent(node)) {
                return;
            }
            componentStack.pop();
        },
        VariableDeclarator(node) {
            if (
                !node.init
                || node.init.type !== 'CallExpression'
                || node.init.callee.name !== 'useOnyx'
            ) {
                return;
            }

            if (node.init.arguments.length < 2) {
                return;
            }

            const optionsArgument = node.init.arguments[1];
            switch (optionsArgument.type) {
                case 'ObjectExpression': {
                    if (hasInlineSelector(optionsArgument)) {
                        context.report({
                            node: node.init,
                            messageId: 'noInlineSelector',
                        });
                    } else {
                        const selectorProperty = findSelectorProperty(optionsArgument);
                        if (selectorProperty && selectorProperty.value.type === 'Identifier') {
                            checkSelectorMemoization(selectorProperty.value.name, node.init);
                        }
                    }
                    break;
                }

                case 'Identifier': {
                    const resolvedValue = getVariableValue(optionsArgument.name, node);
                    if (resolvedValue && hasInlineSelector(resolvedValue)) {
                        context.report({
                            node: node.init,
                            messageId: 'noInlineSelector',
                        });
                    } else if (resolvedValue) {
                        const selectorProperty = findSelectorProperty(resolvedValue);
                        if (selectorProperty && selectorProperty.value.type === 'Identifier') {
                            checkSelectorMemoization(selectorProperty.value.name, node.init);
                        }
                    }
                    break;
                }

                default: {
                    break;
                }
            }
        },
    };
}

export {meta, create};