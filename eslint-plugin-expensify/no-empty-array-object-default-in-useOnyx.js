/**
 * @typedef {import('eslint').Rule.RuleModule} RuleModule
 */

/** @type {RuleModule} */
module.exports = {
    name: 'no-empty-array-object-default-in-useOnyx',
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow empty array or object as default values in useOnyx destructuring assignments. Use getEmptyArray() or getEmptyObject() instead.',
            recommended: 'error',
        },
        schema: [],
        messages: {
            noEmptyArrayDefault: 'Avoid using empty array [] as default value in useOnyx. Use getEmptyArray<T>() instead.',
            noEmptyObjectDefault: 'Avoid using empty object {} as default value in useOnyx. Use getEmptyObject<T>() instead.',
        },
    },
    create(context) {
        return {
            VariableDeclarator(node) {
                if (
                    !node.init
                    || node.init.type !== 'CallExpression'
                    || node.init.callee.name !== 'useOnyx'
                ) {
                    return;
                }

                // Check if the variable declaration is an array pattern (destructuring)
                if (node.id.type !== 'ArrayPattern') {
                    return;
                }

                node.id.elements.forEach((element) => {
                    if (!element || element.type !== 'AssignmentPattern') {
                        return;
                    }

                    const defaultValue = element.right;

                    // Check for empty array default
                    if (defaultValue.type === 'ArrayExpression' && defaultValue.elements.length === 0) {
                        context.report({
                            node: defaultValue,
                            messageId: 'noEmptyArrayDefault',
                        });
                    }

                    // Check for empty object default
                    if (defaultValue.type === 'ObjectExpression' && defaultValue.properties.length === 0) {
                        context.report({
                            node: defaultValue,
                            messageId: 'noEmptyObjectDefault',
                        });
                    }
                });
            },
        };
    },
};
