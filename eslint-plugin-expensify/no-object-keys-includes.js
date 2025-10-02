import CONST from './CONST.js';

const message = CONST.MESSAGE.NO_OBJECT_KEYS_INCLUDES;

const meta = {
    type: 'problem',
    docs: {
        description: 'Disallow using Object.keys().includes() for performance reasons',
        category: 'Performance',
        recommended: true,
    },
    fixable: 'code',
    messages: {
        noObjectKeysIncludes: message,
    },
    schema: [],
};

function create(context) {
    const sourceCode = context.getSourceCode();

    function isObjectKeysCall(node) {
        return (
            node.type === 'CallExpression'
            && node.callee.type === 'MemberExpression'
            && node.callee.object.type === 'Identifier'
            && node.callee.object.name === 'Object'
            && node.callee.property.type === 'Identifier'
            && node.callee.property.name === 'keys'
            && node.arguments.length === 1
        );
    }

    return {
        CallExpression(node) {
            // Check for Object.keys().includes()
            if (
                node.callee.type !== 'MemberExpression'
                || node.callee.property.type !== 'Identifier'
                || node.callee.property.name !== 'includes'
                || !isObjectKeysCall(node.callee.object)
            ) {
                return;
            }

            const objectArg = node.callee.object.arguments[0];
            const includesArg = node.arguments[0];

            const objectText = sourceCode.getText(objectArg);
            const includesText = sourceCode.getText(includesArg);

            context.report({
                node,
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: objectText,
                    key: includesText,
                },
                fix(fixer) {
                    // Suggest using the 'in' operator
                    // Replace Object.keys(obj).includes(key) with (key in obj)
                    // Add parentheses only when necessary for precedence
                    const parent = node.parent;
                    const needsParens = parent && (
                        parent.type === 'LogicalExpression'
                        || parent.type === 'ConditionalExpression'
                        || (parent.type === 'UnaryExpression' && parent.operator === '!')
                    );
                    const replacement = needsParens
                        ? `(${includesText} in ${objectText})`
                        : `${includesText} in ${objectText}`;
                    return fixer.replaceText(node, replacement);
                },
            });
        },
    };
}

export {meta, create};
