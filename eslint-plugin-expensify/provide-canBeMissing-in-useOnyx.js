import {getVariableAsObject, findProperty} from './utils/astUtil.js';

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
                    if (!findProperty(optionsArgument, 'canBeMissing')) {
                        context.report({
                            node: node.init,
                            messageId: 'provideCanBeMissing',
                        });
                    }
                    break;
                }

                case 'Identifier': {
                    const resolvedValue = getVariableAsObject(context, optionsArgument.name, node);
                    if (!resolvedValue) {
                        context.report({
                            node: node.init,
                            messageId: 'provideCanBeMissing',
                        });
                        return;
                    }

                    if (!findProperty(resolvedValue, 'canBeMissing')) {
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
