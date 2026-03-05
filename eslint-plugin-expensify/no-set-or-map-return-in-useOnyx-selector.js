import _ from 'underscore';
import {getVariableInit, getVariableAsObject, findProperty} from './utils/astUtil.js';

const meta = {
    type: 'problem',
    docs: {
        description: 'Disallow returning Set, ReadonlySet, Map, or ReadonlyMap from useOnyx selectors.',
        recommended: 'error',
    },
    schema: [],
    messages: {
        noSetOrMapReturn: 'Avoid returning Sets or Maps from useOnyx selectors. '
            + 'The deepEqual comparison used by useOnyx is extremely slow for Set and Map objects. '
            + 'Return an array or plain object instead and convert outside the selector if needed.',
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

            // useCallback / useMemo wrapper
            const callArgs = _.get(init, 'arguments', []);
            if (init.type === 'CallExpression' && callArgs.length > 0 && init.callee && init.callee.type === 'Identifier') {
                const hookName = init.callee.name;
                const inner = callArgs[0];

                // useCallback: const sel = useCallback((d) => ..., [])
                if (hookName === 'useCallback' && (inner.type === 'ArrowFunctionExpression' || inner.type === 'FunctionExpression')) {
                    return inner;
                }

                // useMemo: const sel = useMemo(() => (d) => ..., [])
                if (hookName === 'useMemo' && (inner.type === 'ArrowFunctionExpression' || inner.type === 'FunctionExpression')) {
                    // Implicit arrow return: useMemo(() => (d) => ..., [])
                    if (inner.body.type === 'ArrowFunctionExpression' || inner.body.type === 'FunctionExpression') {
                        return inner.body;
                    }

                    // Block body: useMemo(() => { return (d) => ...; }, [])
                    if (inner.body.type === 'BlockStatement') {
                        for (const stmt of inner.body.body) {
                            if (stmt.type === 'ReturnStatement' && stmt.argument
                                && (stmt.argument.type === 'ArrowFunctionExpression' || stmt.argument.type === 'FunctionExpression')) {
                                return stmt.argument;
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check if a node is `new Set(...)`, `new ReadonlySet(...)`, `new Map(...)`, or `new ReadonlyMap(...)`.
     *
     * @param {Node} node - The node to check.
     * @returns {boolean}
     */
    function isNewSetOrMapExpression(node) {
        return node
            && node.type === 'NewExpression'
            && node.callee
            && node.callee.type === 'Identifier'
            && (node.callee.name === 'Set' || node.callee.name === 'ReadonlySet'
                || node.callee.name === 'Map' || node.callee.name === 'ReadonlyMap');
    }

    /**
     * Check if an expression could evaluate to a new Set or Map.
     * Handles direct NewExpression and ConditionalExpression (ternary).
     *
     * @param {Node} node - The expression node to check.
     * @returns {boolean}
     */
    function expressionMayReturnSetOrMap(node) {
        if (!node) {
            return false;
        }

        if (isNewSetOrMapExpression(node)) {
            return true;
        }

        if (node.type === 'ConditionalExpression') {
            return isNewSetOrMapExpression(node.consequent) || isNewSetOrMapExpression(node.alternate);
        }

        return false;
    }

    /**
     * Check if a function body returns a new Set or Map in return positions.
     *
     * @param {Node} body - The function body node.
     * @returns {boolean}
     */
    function bodyReturnsNewSetOrMap(body) {
        if (!body) {
            return false;
        }

        // Implicit arrow return: (d) => new Set(d) / new Map(d) or ternary variants
        if (expressionMayReturnSetOrMap(body)) {
            return true;
        }

        // Block body: check return statements
        if (body.type === 'BlockStatement') {
            for (const stmt of body.body) {
                if (stmt.type !== 'ReturnStatement' || !stmt.argument) {
                    continue;
                }

                // Direct or ternary: return new Set(d) / return new Map(d) / ternary variants
                if (expressionMayReturnSetOrMap(stmt.argument)) {
                    return true;
                }

                // Variable tracing: const s = new Set(d); return s;
                if (stmt.argument.type === 'Identifier') {
                    const init = getVariableInit(context, stmt.argument.name, stmt);
                    if (isNewSetOrMapExpression(init)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Check if a function's return type annotation references Set, ReadonlySet, Map, or ReadonlyMap.
     *
     * @param {Function} funcNode - The function node to check.
     * @returns {boolean}
     */
    function hasSetOrMapReturnType(funcNode) {
        const returnType = _.get(funcNode, 'returnType.typeAnnotation');
        if (!returnType) {
            return false;
        }

        if (returnType.type === 'TSTypeReference') {
            const typeName = _.get(returnType, 'typeName.name');
            return typeName === 'Set' || typeName === 'ReadonlySet'
                || typeName === 'Map' || typeName === 'ReadonlyMap';
        }

        return false;
    }

    /**
     * Check a resolved selector function for Set or Map returns and report if found.
     *
     * @param {Function|null} selectorFunc - The resolved selector function node.
     * @param {Node} reportNode - The node to report the error on.
     */
    function checkSelectorForSetOrMap(selectorFunc, reportNode) {
        if (!selectorFunc) {
            return;
        }

        if (bodyReturnsNewSetOrMap(selectorFunc.body) || hasSetOrMapReturnType(selectorFunc)) {
            context.report({
                node: reportNode,
                messageId: 'noSetOrMapReturn',
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
                        checkSelectorForSetOrMap(func, node.init);
                    }
                    break;
                }

                case 'Identifier': {
                    const resolved = getVariableAsObject(context, optionsArgument.name, node);
                    if (resolved) {
                        const selectorProperty = findProperty(resolved, 'selector');
                        if (selectorProperty) {
                            const func = resolveSelectorFunction(selectorProperty.value, node);
                            checkSelectorForSetOrMap(func, node.init);
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
