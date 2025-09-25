import _ from 'underscore';

/**
 * @typedef {import('eslint').Rule.Node} ASTNode
 * @typedef {import('estree').ObjectExpression} ObjectExpression
 */

const name = 'provide-canBeMissing-in-useOnyx';

const meta = {
    type: 'problem',
    docs: {
        description: 'Enforces use of "canBeMissing" option in useOnyx calls.',
        recommended: 'error',
    },
    schema: [],
    messages: {
        provideCanBeMissing: 'useOnyx() calls require you to pass the "canBeMissing" param.',
    },
};

function create(context) {
    /**
     * Find the variable declaration and return the value.
     *
     * @param {string} variableName - The name of the variable to resolve.
     * @param {ASTNode} node - The node containing the variable declaration.
     * @returns {ObjectExpression|null}
     */
    function getVariableValue(variableName, node) {
        try {
            const scope = context.sourceCode.getScope(node);
            const variable = scope.set.get(variableName);

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
}

export {name, meta, create};
