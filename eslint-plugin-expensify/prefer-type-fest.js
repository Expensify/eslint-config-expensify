/* eslint-disable es/no-optional-chaining */
const {AST_NODE_TYPES} = require('@typescript-eslint/utils');
const {PREFER_TYPE_FEST_VALUE_OF, PREFER_TYPE_FEST_TUPLE_TO_UNION} = require('./CONST').MESSAGE;
const {addNamedImport} = require('./utils/imports');

const rule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Enforce using type-fest utility types for better type readability',
        },
        fixable: 'code',
    },
    create(context) {
        let typeFestImport;

        return {
            Program(node) {
                // Find type-fest import declarations
                node.body.forEach(statement => {
                  if (statement.type === 'ImportDeclaration' && statement.source.value === 'type-fest') {
                    typeFestImport = statement;
                  }
                });
              },
            TSIndexedAccessType(node) {
                const objectType = node.objectType;
                const indexType = node.indexType;

                // Ensure that both objectType and indexType exist
                if (!objectType || !indexType) {
                    return;
                }

                // Ensure that objectType is of TSTypeQuery type
                if (objectType?.type !== AST_NODE_TYPES.TSTypeQuery) {
                    return;
                }

                // Case for when the object type is a plain identifier (COLORS)
                if (objectType?.exprName?.type === AST_NODE_TYPES.Identifier) {
                    const objectTypeText = context.getSourceCode().getText(objectType.exprName);

                    // Ensure that indexType is keyed by type 'keyof' ((typeof COLORS)[keyof COLORS])
                    if (indexType?.type === AST_NODE_TYPES.TSTypeOperator && indexType?.operator === 'keyof') {
                        // Ensure that the object type is the same as the index type and both exist

                        const indexTypeText = context.getSourceCode().getText(indexType.typeAnnotation.typeName);
                        if (objectTypeText && objectTypeText === indexTypeText) {
                            context.report({
                                node,
                                message: PREFER_TYPE_FEST_VALUE_OF,
                                fix: (fixer) => {
                                    const fixes = [fixer.replaceText(node, `ValueOf<typeof ${objectTypeText}>`)];
                                    fixes.push(...addNamedImport(context, fixer, typeFestImport, 'ValueOf', 'type-fest', true));
                                    return fixes;
                                }
                            });
                        }
                    }

                    // Ensure that indexType is keyed by type 'number' ((typeof STUFF)[number])
                    if (indexType?.type === AST_NODE_TYPES.TSNumberKeyword) {
                        context.report({
                            node,
                            message: PREFER_TYPE_FEST_TUPLE_TO_UNION,
                            fix: (fixer) => {
                                const fixes = [fixer.replaceText(node, `TupleToUnion<typeof ${objectTypeText}>`)];
                                fixes.push(...addNamedImport(context, fixer, typeFestImport, 'TupleToUnion', 'type-fest', true));
                                return fixes;
                            }
                        });
                    }
                }

                // Case for when the object type is a nested object (CONST.VIDEO_PLAYER.PLAYBACK_SPEEDS)
                if (objectType?.exprName?.type === AST_NODE_TYPES.TSQualifiedName) {
                    const objectTypeText = context.getSourceCode().getText(objectType.exprName);

                    // Ensure that indexType is keyed by type 'keyof' ((typeof CONST.VIDEO_PLAYER)[keyof CONST.VIDEO_PLAYER])
                    if (indexType?.type === AST_NODE_TYPES.TSTypeOperator && indexType?.operator === 'keyof') {
                        const indexTypeText = context.getSourceCode().getText(indexType.typeAnnotation.exprName);

                        if (objectTypeText && objectTypeText === indexTypeText) {
                            context.report({
                                node,
                                message: PREFER_TYPE_FEST_VALUE_OF,
                                fix: (fixer) => {
                                    const fixes = [fixer.replaceText(node, `ValueOf<typeof ${objectTypeText}>`)];
                                    fixes.push(...addNamedImport(context, fixer, typeFestImport, 'ValueOf', 'type-fest', true));
                                    return fixes;
                                }
                            });
                        }
                    }

                    // Ensure that indexType is keyed by type 'number' ((typeof CONST.VIDEO_PLAYER.PLAYBACK_SPEEDS)[number])
                    if (indexType?.type === AST_NODE_TYPES.TSNumberKeyword) {
                        context.report({
                            node,
                            message: PREFER_TYPE_FEST_TUPLE_TO_UNION,
                            fix: (fixer) => {
                                const fixes = [fixer.replaceText(node, `TupleToUnion<typeof ${objectTypeText}>`)];
                                fixes.push(...addNamedImport(context, fixer, typeFestImport, 'TupleToUnion', 'type-fest', true));
                                return fixes;
                            }
                        });
                    }
                }
            },
        };
    },
};

module.exports = rule;
