const _ = require('underscore');

/**
 * @typedef {import('eslint').Rule.RuleModule} RuleModule
 * @typedef {import('estree').ObjectExpression} ObjectExpression
 * @typedef {import('estree').Property} Property
 */

/** @type {RuleModule} */
module.exports = {
    name: 'no-inline-useOnyx-selector',
    meta: {
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
        },
    },
    create(context) {
        /**
         * Find the variable declaration and return the value.
         *
         * @param {string} name - The name of the variable to resolve.
         * @returns {ObjectExpression|null}
         */
        function getVariableValue(name) {
            try {
                const scope = context.getScope();
                const variable = scope.set.get(name);

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

        return {
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
                        }
                        break;
                    }

                    case 'Identifier': {
                        const resolvedValue = getVariableValue(optionsArgument.name);
                        if (resolvedValue && hasInlineSelector(resolvedValue)) {
                            context.report({
                                node: node.init,
                                messageId: 'noInlineSelector',
                            });
                        }
                        break;
                    }

                    default: {
                        break;
                    }
                }
            },
        };
    },
};
