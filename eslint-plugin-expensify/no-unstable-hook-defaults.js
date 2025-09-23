/**
 * @typedef {import('eslint').Rule.RuleModule} RuleModule
 */

/** @type {RuleModule} */
module.exports = {
    name: 'no-unstable-hook-defaults',
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow inline array or object literals as default values in hooks. Use getEmptyArray(), getEmptyObject(), a constant, or a memoized value instead.',
            recommended: 'error',
        },
        schema: [],
        messages: {
            noEmptyArrayDefault: 'Avoid using empty array [] as default value in hooks. Use getEmptyArray<T>() instead.',
            noInlineArrayDefault: 'Avoid using array literal as default value in hooks. Use a memoized value or a constant instead.',
            noEmptyObjectDefault: 'Avoid using empty object {} as default value in hooks. Use getEmptyObject<T>() instead.',
            noInlineObjectDefault: 'Avoid using object literal as default value in hooks. Use a memoized value or a constant instead.',
            noUnstableIdentifierDefault: 'Default value must be memoized with useMemo or declared as a top-level constant.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        function checkDefaultValue(defaultValue) {
            // Check for inline array default
            if (defaultValue.type === 'ArrayExpression') {
                const isEmpty = defaultValue.elements.length === 0;
                context.report({
                    node: defaultValue,
                    messageId: isEmpty ? 'noEmptyArrayDefault' : 'noInlineArrayDefault',
                });
            }

            // Check for inline object default
            if (defaultValue.type === 'ObjectExpression') {
                const isEmpty = defaultValue.properties.length === 0;
                context.report({
                    node: defaultValue,
                    messageId: isEmpty ? 'noEmptyObjectDefault' : 'noInlineObjectDefault',
                });
            }

            // If it's an Identifier, verify it's memoized or top-level const
            if (defaultValue.type === 'Identifier') {
                const scope = sourceCode.getScope(defaultValue);
                const variable = scope.set.get(defaultValue.name);

                if (
                    variable
                    && variable.defs.length > 0
                    && variable.defs[0].node.type === 'VariableDeclarator'
                ) {
                    const def = variable.defs[0].node;
                    const init = def.init;

                    const isMemoized = init
                        && init.type === 'CallExpression'
                        && init.callee.type === 'Identifier'
                        && init.callee.name === 'useMemo';

                    const isTopLevelConst = variable.scope.type === 'module'
                        && variable.defs[0].parent.kind === 'const';

                    if (!isMemoized && !isTopLevelConst) {
                        context.report({
                            node: defaultValue,
                            messageId: 'noUnstableIdentifierDefault',
                        });
                    }
                }
            }
        }

        return {
            VariableDeclarator(node) {
                if (
                    !node.init
                    || node.init.type !== 'CallExpression'
                    || !node.init.callee.name
                    || !node.init.callee.name.startsWith('use')
                ) {
                    return;
                }

                // Check if the variable declaration is an array pattern (destructuring)
                if (node.id.type === 'ArrayPattern') {
                    node.id.elements.forEach((element) => {
                        if (!element || element.type !== 'AssignmentPattern') {
                            return;
                        }
                        checkDefaultValue(element.right);
                    });
                }

                // Check if the variable declaration is an object pattern (destructuring)
                if (node.id.type === 'ObjectPattern') {
                    node.id.properties.forEach((property) => {
                        if (!property || property.type !== 'Property' || property.value.type !== 'AssignmentPattern') {
                            return;
                        }
                        checkDefaultValue(property.value.right);
                    });
                }
            },
        };
    },
};
