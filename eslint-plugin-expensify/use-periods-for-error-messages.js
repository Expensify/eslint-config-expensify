require('lodash/get');
const message = require('./CONST').MESSAGE.USE_PERIODS_ERROR_MESSAGES;

module.exports = {
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
                    if (!errorMessage.endsWith('.')) {
                        context.report({
                            node: property,
                            message,
                            fix: function (fixer) {
                                const lastChar = errorMessage[errorMessage.length - 1];
                                const fixedMessage = lastChar === '.' ? errorMessage : `${errorMessage}.`;
                                return fixer.replaceText(property.value, `'${fixedMessage}'`);
                            }
                        });
                    }
                });
            },
        };
    },
};
