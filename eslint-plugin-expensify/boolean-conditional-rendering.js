/* eslint-disable no-bitwise */
import _ from 'underscore';
import {ESLintUtils} from '@typescript-eslint/utils';
import ts from 'typescript';

const name = 'boolean-conditional-rendering';

const meta = {
    type: 'problem',
    docs: {
        description: 'Enforce boolean conditions in React conditional rendering',
        recommended: 'error',
    },
    schema: [],
    messages: {
        nonBooleanConditional: 'The left side of conditional rendering should be a boolean, not "{{type}}".',
    },
};

const defaultOptions = [];

function create(context) {
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
}

export {
    name,
    meta,
    defaultOptions,
    create,
};
