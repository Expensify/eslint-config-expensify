/* eslint-disable es/no-optional-chaining */
const {AST_NODE_TYPES} = require('@typescript-eslint/utils');
const {PREFER_TYPE_FEST_VALUE_OF, PREFER_TYPE_FEST_TUPLE_TO_UNION} = require('./CONST').MESSAGE;

const rule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Enforce using type-fest utility types for better type readability',
        },
        fixable: 'code',
    },
    create(context) {
        return {
            TSIndexedAccessType(node) {
                // Ensuring that objectType is an identifier
                if (node.objectType.type !== AST_NODE_TYPES.TSTypeQuery && node.objectType?.exprName.type !== AST_NODE_TYPES.Identifier) {
                    return;
                }

                // Ensuring that indexType is keyed by type 'keyof'
                if (node.indexType?.type !== AST_NODE_TYPES.TSTypeOperator && node.indexType?.operator !== 'keyof') {
                    return;
                }

                // Ensuring that the object type is the same as the index type
                if (node.objectType?.exprName.name !== node.indexType?.typeAnnotation?.typeName.name) {
                    return;
                }

                context.report({
                    node,
                    message: PREFER_TYPE_FEST_VALUE_OF,
                    fix(fixer) {
                        return fixer.replaceText(
                            node,
                            `ValueOf<typeof ${node.objectType.exprName.name}>`,
                        );
                    },
                });
            },
        };
    },
};

module.exports = rule;

