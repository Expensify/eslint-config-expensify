import _ from 'underscore';
import {getVariableInit, getVariableAsObject, findProperty} from './utils/astUtil.js';

const meta = {
    type: 'problem',
    docs: {
        description: 'Disallow returning Set or ReadonlySet from useOnyx selectors.',
        recommended: 'error',
    },
    schema: [],
    messages: {
        noSetReturn: 'Avoid returning Sets from useOnyx selectors. '
            + 'The deepEqual comparison used by useOnyx is extremely slow for Set objects. '
            + 'Return an array instead and convert to Set outside the selector if needed.',
    },
};

function create(context) {
    /**
     * Get the actual function node for a selector value.
     * Handles: inline function, Identifier reference, useCallback wrapper.
     *
     * @param {Node} selectorValue - The selector property's value node.
     * @param {Node} refNode - The node to get scope from.
     * @returns {Function|null}
     */
    function resolveSelectorFunction(selectorValue, refNode) {
        if (!selectorValue) {
            return null;
        }

        if (selectorValue.type === 'ArrowFunctionExpression' || selectorValue.type === 'FunctionExpression') {
            return selectorValue;
        }

        if (selectorValue.type === 'Identifier') {
            const init = getVariableInit(context, selectorValue.name, refNode);
            if (!init) {
                return null;
            }

            if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
                return init;
            }

            // useCallback wrapper: const mySelector = useCallback((d) => ..., [])
            const callArgs = _.get(init, 'arguments', []);
            if (init.type === 'CallExpression' && init.callee.name === 'useCallback' && callArgs.length > 0) {
                const inner = callArgs[0];
                if (inner.type === 'ArrowFunctionExpression' || inner.type === 'FunctionExpression') {
                    return inner;
                }
            }
        }

        return null;
    }

    /**
     * Check if a node is `new Set(...)` or `new ReadonlySet(...)`.
     *
     * @param {Node} node - The node to check.
     * @returns {boolean}
     */
    function isNewSetExpression(node) {
        return node
            && node.type === 'NewExpression'
            && node.callee
            && node.callee.type === 'Identifier'
            && (node.callee.name === 'Set' || node.callee.name === 'ReadonlySet');
    }

    /**
     * Check if a function body returns a new Set in return positions.
     *
     * @param {Node} body - The function body node.
     * @returns {boolean}
     */
    function bodyReturnsNewSet(body) {
        if (!body) {
            return false;
        }

        // Implicit arrow return: (d) => new Set(d)
        if (isNewSetExpression(body)) {
            return true;
        }

        // Block body: check return statements
        if (body.type === 'BlockStatement') {
            for (const stmt of body.body) {
                if (stmt.type !== 'ReturnStatement' || !stmt.argument) {
                    continue;
                }

                // Direct: return new Set(d)
                if (isNewSetExpression(stmt.argument)) {
                    return true;
                }

                // Variable tracing: const s = new Set(d); return s;
                if (stmt.argument.type === 'Identifier') {
                    const init = getVariableInit(context, stmt.argument.name, stmt);
                    if (isNewSetExpression(init)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Check if a function's return type annotation references Set or ReadonlySet.
     *
     * @param {Function} funcNode - The function node to check.
     * @returns {boolean}
     */
    function hasSetReturnType(funcNode) {
        const returnType = _.get(funcNode, 'returnType.typeAnnotation');
        if (!returnType) {
            return false;
        }

        if (returnType.type === 'TSTypeReference') {
            const typeName = _.get(returnType, 'typeName.name');
            return typeName === 'Set' || typeName === 'ReadonlySet';
        }

        return false;
    }

    /**
     * Check a resolved selector function for Set returns and report if found.
     *
     * @param {Function|null} selectorFunc - The resolved selector function node.
     * @param {Node} reportNode - The node to report the error on.
     */
    function checkSelectorForSet(selectorFunc, reportNode) {
        if (!selectorFunc) {
            return;
        }

        if (bodyReturnsNewSet(selectorFunc.body) || hasSetReturnType(selectorFunc)) {
            context.report({
                node: reportNode,
                messageId: 'noSetReturn',
            });
        }
    }

    return {
        VariableDeclarator(node) {
            if (
                !node.init
                || node.init.type !== 'CallExpression'
                || node.init.callee.name !== 'useOnyx'
            ) {
                return;
            }

            if (node.init.arguments.length < 2) {
                return;
            }

            const optionsArgument = node.init.arguments[1];
            switch (optionsArgument.type) {
                case 'ObjectExpression': {
                    const selectorProperty = findProperty(optionsArgument, 'selector');
                    if (selectorProperty) {
                        const func = resolveSelectorFunction(selectorProperty.value, node);
                        checkSelectorForSet(func, node.init);
                    }
                    break;
                }

                case 'Identifier': {
                    const resolved = getVariableAsObject(context, optionsArgument.name, node);
                    if (resolved) {
                        const selectorProperty = findProperty(resolved, 'selector');
                        if (selectorProperty) {
                            const func = resolveSelectorFunction(selectorProperty.value, node);
                            checkSelectorForSet(func, node.init);
                        }
                    }
                    break;
                }

                default: {
                    break;
                }
            }
        },
    };
}

export {meta, create};
