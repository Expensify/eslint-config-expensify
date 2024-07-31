const message = require('./CONST').MESSAGE.USE_PERIODS_ERROR_MESSAGES;

module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Enforce using periods at the end of error messages',
        },
        fixable: 'code',
    },
    create(context) {
        return {
            Property(node) {
                if (!node.key || node.key.name !== 'error' || !node.value || node.value.type !== 'ObjectExpression') {
                    return;
                }
                node.value.properties.forEach((property) => {
                    if (!property.value || property.value.type !== 'Literal' || typeof property.value.value !== 'string') {
                        return;
                    }
                    const errorMessage = property.value.value;

                    // Only enforce period rule if more than one sentence
                    const sentenceCount = errorMessage.split('.').filter(sentence => sentence.trim().length > 0).length;

                    if (sentenceCount > 1 && !errorMessage.endsWith('.')) {
                        context.report({
                            node: property,
                            message,
                            fix: function (fixer) {
                                const fixedMessage = `${errorMessage}.`;
                                return fixer.replaceText(property.value, `'${fixedMessage}'`);
                            }
                        });
                    }
                });
            },
        };
    },
};
