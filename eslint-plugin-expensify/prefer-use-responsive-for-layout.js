const _ = require('underscore');
const message = require('./CONST').MESSAGE.PREFER_USE_RESPONSIVE_FOR_LAYOUT;

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prohibit the direct use of isSmallScreenWidth from useWindowDimensions',
        },
    },
    create(context) {
        return {
            VariableDeclarator(node) {
                if (!node.init || !node.init.callee || node.init.callee.name !== 'useWindowDimensions') {
                    return;
                }

                // Check for 'const {isSmallScreenWidth, ...} = useWindowDimensions();' pattern
                if (node.id.type === 'ObjectPattern') {
                    node.id.properties.forEach((property) => {
                        if (!property.key || property.key.name !== 'isSmallScreenWidth') {
                            return;
                        }
                        context.report({
                            node: property,
                            message,
                        });
                    });
                }

                // Check for 'const var = useWindowDimensions();' and use of this var
                const variableName = node.id.name;
                const variableUsages = _.filter(context.getScope().references, (reference) => reference.identifier.name === variableName);
                variableUsages.forEach((usage) => {
                    const parent = usage.identifier.parent;

                    // Check for 'const isSmallScreen = var.isSmallScreenWidth;' pattern
                    if (parent.type === 'MemberExpression' && parent.property.name === 'isSmallScreenWidth') {
                        context.report({
                            node: parent.property,
                            message,
                        });
                    }

                    // Check for 'const {isSmallScreenWidth} = var;' pattern
                    if (parent.type === 'VariableDeclarator' && parent.id.type === 'ObjectPattern') {
                        parent.id.properties.forEach((property) => {
                            if (!property.key || property.key.name !== 'isSmallScreenWidth') {
                                return;
                            }
                            context.report({
                                node: property,
                                message,
                            });
                        });
                    }
                });
            },
            MemberExpression(node) {
                // Check for 'const isSmallScreen = useWindowDimensions().isSmallScreenWidth;' pattern
                if (node.object.type !== 'CallExpression' || node.object.callee.name !== 'useWindowDimensions' || node.property.name !== 'isSmallScreenWidth') {
                    return;
                }
                context.report({
                    node,
                    message,
                });
            },
        };
    },
};
