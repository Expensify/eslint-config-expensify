const message = require('./CONST').MESSAGE.USE_DOUBLE_NEGATION_INSTEAD_OF_BOOLEAN;

module.exports = {
    meta: {
        fixable: 'code',
    },
    create(context) {
        return {
            CallExpression(node) {
                if (node.callee.type === 'Identifier' && node.callee.name === 'Boolean' && node.arguments.length === 1) {
                    const argument = node.arguments[0];
                    const sourceCode = context.getSourceCode();
                    const argumentText = sourceCode.getText(argument);
                    let fixedText = `!!${argumentText}`;

                    if (argument.type === 'LogicalExpression' || argument.type === 'BinaryExpression') {
                        fixedText = `!!(${argumentText})`;
                    }

                    context.report({
                        node,
                        message,
                        fix(fixer) {
                            return fixer.replaceText(node, fixedText);
                        },
                    });
                }
            },
        };
    },
};
