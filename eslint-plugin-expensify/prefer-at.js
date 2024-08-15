const { AST_NODE_TYPES, ESLintUtils } = require('@typescript-eslint/utils');
const message = require('./CONST').MESSAGE.PREFER_AT;

module.exports = {
    meta: {
        fixable: 'code',
    },
    create(context) {
        const parserServices = ESLintUtils.getParserServices(context);
        const typeChecker = parserServices.program.getTypeChecker();

        function isArrayType(node) {
            if (node.type === 'ArrayExpression') {
                return true;
            }
            const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
            const type = typeChecker.getTypeAtLocation(tsNode);

            return typeChecker.isArrayType(type);
        }

        function getSourceCode(node) {
            return context.getSourceCode().getText(node);
        }

        function parseExpression(node) {
            switch (node.type) {
                case AST_NODE_TYPES.Literal:
                    if (typeof node.value === 'number') {
                        return node.value.toString();
                    }
                    return null;

                case AST_NODE_TYPES.BinaryExpression:
                    const left = parseExpression(node.left);
                    const right = parseExpression(node.right);
                    if (left !== null && right !== null) {
                        return `(${left} ${node.operator} ${right})`;
                    }
                    return null;

                case AST_NODE_TYPES.UnaryExpression:
                    const argument = parseExpression(node.argument);
                    if (argument !== null) {
                        return `${node.operator}${argument}`;
                    }
                    return null;

                case AST_NODE_TYPES.MemberExpression:
                    if (node.property.type === 'Identifier' && node.property.name === 'length') {
                        return `${getSourceCode(node.object)}.length`;
                    }
                    return null;

                case AST_NODE_TYPES.Identifier:
                    return node.name;

                default:
                    return null;
            }
        }

        function getExpressionWithUpdatedBrackets(indexExpression) {
            if (indexExpression.startsWith('(') && indexExpression.endsWith(')')) {
                return indexExpression.slice(1, -1);
            }
            return indexExpression;
        }

        function isAssignmentExpression(node) {
            return node.parent && node.parent.type === AST_NODE_TYPES.AssignmentExpression && node.parent.left === node;
        }

        function checkNode(node) {
            if (node.type === AST_NODE_TYPES.MemberExpression && node.property) {
                if (!isArrayType(node.object)) {
                    return;
                }

                // Skip if the property is a method (like a?.map)
                if (node.parent && node.parent.type === AST_NODE_TYPES.CallExpression && node.parent.callee === node) {
                    return;
                }

                // Skip if the node is part of an assignment expression
                if (isAssignmentExpression(node)) {
                    return;
                }

                const indexExpression = parseExpression(node.property);

                if (indexExpression !== null && indexExpression !== 'length' && indexExpression !== 'at') {
                    context.report({
                        node,
                        message,
                        fix(fixer) {
                            const objectText = getSourceCode(node.object);
                            return fixer.replaceText(node, `${objectText}.at(${getExpressionWithUpdatedBrackets(indexExpression)})`);
                        },
                    });
                }
            }
        }

        function shouldIgnoreNode(node) {
            return (
                node.parent &&
                node.parent.type === AST_NODE_TYPES.MemberExpression &&
                node.parent.property === node
            );
        }

        return {
            MemberExpression(node) {
                if (!shouldIgnoreNode(node)) {
                    checkNode(node);
                }
            },
        };
    },
};
