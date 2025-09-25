import _ from 'underscore';
import CONST from './CONST.js';

const message = CONST.MESSAGE.USE_PERIODS_ERROR_MESSAGES;

const meta = {
    type: 'suggestion',
    docs: {
        description: 'Enforce using periods at the end of error messages',
    },
    fixable: 'code',
};

function create(context) {
    const variableDeclarators = new Map();
    return {
        VariableDeclarator(node) {
            variableDeclarators.set(node.id.name, node);
        },
        NewExpression(node) {
            if (!node.callee || node.callee.name !== 'Error' || node.arguments.length === 0) {
                return;
            }
            const errArg = node.arguments[0];
            let errorMessage = '';
            if (errArg.type === 'Literal') {
                errorMessage = errArg.value;
            } else if (variableDeclarators.has(errArg.name)) {
                const variableDeclarator = variableDeclarators.get(errArg.name);
                if (variableDeclarator.init.type !== 'Literal') {
                    return;
                }
                errorMessage = variableDeclarator.init.value;
            } else {
                return;
            }

            // Only enforce period rule if more than one sentence
            const sentenceCount = _.filter(errorMessage.split('.'), sentence => sentence.trim().length > 0).length;

            const doesViolateRule = (sentenceCount > 1 && !errorMessage.endsWith('.')) || (sentenceCount === 1 && errorMessage.endsWith('.'));
            if (doesViolateRule) {
                context.report({
                    node,
                    message,
                    fix(fixer) {
                        if (errorMessage.type !== 'Literal') {
                            return;
                        }
                        const fixedMessage = `${errorMessage}.`;
                        return fixer.replaceText(node.arguments[0], `'${fixedMessage}'`);
                    },
                });
            }
        },
    };
}

export {meta, create};
