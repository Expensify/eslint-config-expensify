// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/rules/utils/is-left-hand-side.js

import {AST_NODE_TYPES} from '@typescript-eslint/utils';

function isLeftHandSide(node) {
    const {parent} = node;

    return (
        (parent.type === AST_NODE_TYPES.AssignmentExpression || parent.type === AST_NODE_TYPES.AssignmentPattern)
        && parent.left === node
    )
    || (parent.type === AST_NODE_TYPES.UpdateExpression && parent.argument === node)
    || (parent.type === AST_NODE_TYPES.ArrayPattern && parent.elements.includes(node))
    || (
        parent.type === AST_NODE_TYPES.Property
        && parent.value === node
        && parent.parent.type === AST_NODE_TYPES.ObjectPattern
        && parent.parent.properties.includes(parent)
    )
    || (
        parent.type === AST_NODE_TYPES.UnaryExpression
        && parent.operator === 'delete'
        && parent.argument === node
    );
}

// eslint-disable-next-line import/prefer-default-export
export {isLeftHandSide};
