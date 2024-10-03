/* eslint-disable no-bitwise */
const _ = require('underscore');
const {ESLintUtils} = require('@typescript-eslint/utils');
const ts = require('typescript');

module.exports = {
    name: 'boolean-conditional-rendering',
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce boolean conditions in React conditional rendering',
            recommended: 'error',
        },
        schema: [],
        messages: {
            nonBooleanConditional:
        'The left side of conditional rendering should be a boolean, not "{{type}}".',
        },
    },
    defaultOptions: [],
    create(context) {
        function isJSXElement(node) {
            return node.type === 'JSXElement' || node.type === 'JSXFragment';
        }
        function isBoolean(type) {
            return (
                (type.getFlags()
          & (ts.TypeFlags.Boolean
            | ts.TypeFlags.BooleanLike
            | ts.TypeFlags.BooleanLiteral))
          !== 0
        || (type.isUnion()
          && _.every(
              type.types,
              t => (t.getFlags()
                & (ts.TypeFlags.Boolean
                  | ts.TypeFlags.BooleanLike
                  | ts.TypeFlags.BooleanLiteral))
              !== 0,
          ))
            );
        }
        const parserServices = ESLintUtils.getParserServices(context);
        const typeChecker = parserServices.program.getTypeChecker();
        return {
            LogicalExpression(node) {
                if (!(node.operator === '&&' && isJSXElement(node.right))) {
                    return;
                }
                const leftType = typeChecker.getTypeAtLocation(
                    parserServices.esTreeNodeToTSNodeMap.get(node.left),
                );
                if (!isBoolean(leftType)) {
                    const baseType = typeChecker.getBaseTypeOfLiteralType(leftType);
                    context.report({
                        node: node.left,
                        messageId: 'nonBooleanConditional',
                        data: {
                            type: typeChecker.typeToString(baseType),
                        },
                    });
                }
            },
        };
    },
};
