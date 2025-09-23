const _ = require('underscore');

/**
 * @typedef {import('eslint').Rule.RuleModule} RuleModule
 * @typedef {import('estree').ObjectExpression} ObjectExpression
 */

/** @type {RuleModule} */
module.exports = {
    name: 'provide-canBeMissing-in-useOnyx',
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforces use of "canBeMissing" option in useOnyx calls.',
            recommended: 'error',
        },
        schema: [],
        messages: {
            provideCanBeMissing: 'useOnyx() calls require you to pass the "canBeMissing" param.',
        },
    },
    create(context) {
        /**
         * Find the variable declaration and return the value.
         *
         * @param {string} name - The name of the variable to resolve.
         * @returns {ObjectExpression|null}
         */
        function getVariableValue(name, node) {
            try {
                const scope = context.sourceCode.getScope(node);
                const variable = scope.set.get(name);

                if (variable && variable.defs.length > 0) {
                    const def = variable.defs[0];
                    if (def.node.init && def.node.init.type === 'ObjectExpression') {
                        return def.node.init;
                    }
                }
            } catch {
                return null;
            }

            return null;
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
                    context.report({
                        node: node.init,
                        messageId: 'provideCanBeMissing',
                    });
                    return;
                }

                const optionsArgument = node.init.arguments[1];
                switch (optionsArgument.type) {
                    case 'ObjectExpression': {
                        if (!_.some(optionsArgument.properties, property => property.type === 'Property' && property.key.name === 'canBeMissing')) {
                            context.report({
                                node: node.init,
                                messageId: 'provideCanBeMissing',
                            });
                        }
                        break;
                    }

                    case 'Identifier': {
                        const resolvedValue = getVariableValue(optionsArgument.name, node);
                        if (!resolvedValue) {
                            context.report({
                                node: node.init,
                                messageId: 'provideCanBeMissing',
                            });
                            return;
                        }

                        if (!_.some(resolvedValue.properties, property => property.type === 'Property' && property.key.name === 'canBeMissing')) {
                            context.report({
                                node: node.init,
                                messageId: 'provideCanBeMissing',
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
