import {AST_NODE_TYPES} from '@typescript-eslint/utils';
import _ from 'underscore';
import CONST from './CONST.js';

const meta = {
    type: 'problem',
    docs: {
        description:
    'Warn against using isSmallScreenWidth from useResponsiveLayout and suggest using shouldUseNarrowLayout instead.',
    },
    schema: [],
};

function create(context) {
    // eslint-disable-next-line es/no-nullish-coalescing-operators
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
        VariableDeclarator(node) {
            if (
                !node.init
      || !node.init.callee
      || node.init.callee.name !== 'useResponsiveLayout'
            ) {
                return;
            }

            // Check for 'const {isSmallScreenWidth, ...} = useResponsiveLayout();' pattern
            if (node.id.type === AST_NODE_TYPES.ObjectPattern) {
                for (const property of node.id.properties) {
                    if (!property.key || property.key.name !== 'isSmallScreenWidth') {
                        continue;
                    }
                    context.report({
                        node: property,
                        message:
            CONST.MESSAGE
                .PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH,
                    });
                }
            }

            const scope = sourceCode.getScope ? sourceCode.getScope(node) : context.getScope();

            // Check for 'const var = useResponsiveLayout();' and use of this var
            const variableName = node.id.name;
            const variableUsages = _.filter(
                scope.references,
                reference => reference.identifier.name === variableName,
            );
            for (const usage of variableUsages) {
                const parent = usage.identifier.parent;

                // Check for 'const isSmallScreenWidth = var.isSmallScreenWidth;' pattern
                if (
                    parent.type === AST_NODE_TYPES.MemberExpression
        && parent.property.name === 'isSmallScreenWidth'
                ) {
                    context.report({
                        node: parent.property,
                        message:
            CONST.MESSAGE
                .PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH,
                    });
                }

                // Check for 'const {isSmallScreenWidth} = var;' pattern
                if (
                    parent.type === AST_NODE_TYPES.VariableDeclarator
        && parent.id.type === AST_NODE_TYPES.ObjectPattern
                ) {
                    for (const property of parent.id.properties) {
                        if (!property.key || property.key.name !== 'isSmallScreenWidth') {
                            continue;
                        }
                        context.report({
                            node: property,
                            message:
              CONST.MESSAGE
                  .PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH,
                        });
                    }
                }
            }
        },
        MemberExpression(node) {
            // Check for 'const isSmallScreenWidth = useResponsiveLayout().isSmallScreenWidth;' pattern
            if (
                node.object.type !== 'CallExpression'
      || node.object.callee.name !== 'useResponsiveLayout'
      || node.property.name !== 'isSmallScreenWidth'
            ) {
                return;
            }
            context.report({
                node,
                message:
        CONST.MESSAGE
            .PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH,
            });
        },
    };
}

export {meta, create};
