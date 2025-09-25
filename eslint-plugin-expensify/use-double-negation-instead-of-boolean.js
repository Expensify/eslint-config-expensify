import CONST from './CONST.js';

const message = CONST.MESSAGE.USE_DOUBLE_NEGATION_INSTEAD_OF_BOOLEAN;

const meta = {
    fixable: 'code',
};

function create(context) {
    return {
        CallExpression(node) {
            if (node.callee.type !== 'Identifier' || node.callee.name !== 'Boolean' || node.arguments.length !== 1) {
                return;
            }
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
        },
    };
}

export {meta, create};
