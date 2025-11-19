const meta = {
    type: 'suggestion',
    docs: {
        description: 'Enforce narrowing down React hook dependency arrays to specific properties instead of entire objects',
        recommended: 'warn',
    },
    fixable: 'code',
    schema: [],
    messages: {
        narrowDependency: 'Dependency "{{dependency}}" is too broad. Use specific properties instead: {{properties}}',
    },
};

function create(context) {
    /**
     * Check if a call expression is a React hook
     * @param {CallExpression} node
     * @returns {boolean}
     */
    function isReactHook(node) {
        return (
            node.type === 'CallExpression'
            && node.callee.type === 'Identifier'
            && node.callee.name.startsWith('use')
        );
    }

    /**
     * Get the dependency array from a React hook call
     * @param {CallExpression} hookCall
     * @returns {ArrayExpression|null}
     */
    function getDependencyArray(hookCall) {
        const args = hookCall.arguments;
        if (args.length === 0) {
            return null;
        }

        const lastArg = args[args.length - 1];
        return lastArg.type === 'ArrayExpression' ? lastArg : null;
    }

    /**
     * Recursively collect all member expressions and direct usages from a node using ESLint traversal
     * @param {Node} node
     * @param {Array<string>} memberExpressions - Array to preserve order
     * @param {Set<string>} directUsages
     * @param {Set<Node>} visited
     */
    function collectMemberExpressions(node, memberExpressions, directUsages, visited = new Set()) {
        if (!node || !node.type || visited.has(node)) {
            return;
        }

        visited.add(node);

        // If this is a member expression, process it
        if (node.type === 'MemberExpression') {
            // Check if this member expression is the callee of a function call
            // If so, the object is being used as a whole (for its method)
            if (node.parent && node.parent.type === 'CallExpression' && node.parent.callee === node) {
                const objectName = getObjectName(node);
                if (objectName) {
                    directUsages.add(objectName);
                }
            } else if (node.computed) {
                // Computed property access like obj[key] - mark object as directly used
                const objectName = getObjectName(node.object);
                if (objectName) {
                    directUsages.add(objectName);
                }
            } else {
                // Regular property access - collect the full path
                const fullPath = getMemberExpressionPath(node);
                if (fullPath && !memberExpressions.includes(fullPath)) {
                    memberExpressions.push(fullPath);
                }
            }
            // Don't return - continue to traverse children
        }

        // If identifier is used directly (not part of a member expression), mark as direct usage
        if (node.type === 'Identifier' && node.parent) {
            const parent = node.parent;
            // Check if this is NOT the object/property part of a MemberExpression
            if (parent.type !== 'MemberExpression' || 
                (parent.type === 'MemberExpression' && parent.property === node && !parent.computed)) {
                // Skip if it's the property name in a non-computed member expression
                if (!(parent.type === 'MemberExpression' && parent.property === node)) {
                    directUsages.add(node.name);
                }
            }
        }

        // Carefully traverse specific child nodes to avoid circular references
        if (node.type === 'MemberExpression') {
            collectMemberExpressions(node.object, memberExpressions, directUsages, visited);
        } else if (node.type === 'ChainExpression') {
            // Optional chaining is wrapped in ChainExpression
            collectMemberExpressions(node.expression, memberExpressions, directUsages, visited);
        } else if (node.type === 'CallExpression') {
            collectMemberExpressions(node.callee, memberExpressions, directUsages, visited);
            if (node.arguments) {
                for (const arg of node.arguments) {
                    collectMemberExpressions(arg, memberExpressions, directUsages, visited);
                }
            }
        } else if (node.type === 'BlockStatement' || node.type === 'Program') {
            if (node.body) {
                for (const statement of node.body) {
                    collectMemberExpressions(statement, memberExpressions, directUsages, visited);
                }
            }
        } else if (node.type === 'ExpressionStatement') {
            collectMemberExpressions(node.expression, memberExpressions, directUsages, visited);
        } else if (node.type === 'ReturnStatement') {
            collectMemberExpressions(node.argument, memberExpressions, directUsages, visited);
        } else if (node.type === 'IfStatement') {
            collectMemberExpressions(node.test, memberExpressions, directUsages, visited);
            collectMemberExpressions(node.consequent, memberExpressions, directUsages, visited);
            collectMemberExpressions(node.alternate, memberExpressions, directUsages, visited);
        } else if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
            collectMemberExpressions(node.left, memberExpressions, directUsages, visited);
            collectMemberExpressions(node.right, memberExpressions, directUsages, visited);
        } else if (node.type === 'UnaryExpression') {
            collectMemberExpressions(node.argument, memberExpressions, directUsages, visited);
        } else if (node.type === 'ConditionalExpression') {
            collectMemberExpressions(node.test, memberExpressions, directUsages, visited);
            collectMemberExpressions(node.consequent, memberExpressions, directUsages, visited);
            collectMemberExpressions(node.alternate, memberExpressions, directUsages, visited);
        } else if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
            // Don't traverse into nested functions - they have their own scope
            return;
        }
    }

    /**
     * Get the full path of a member expression as a string
     * @param {MemberExpression} node
     * @returns {string|null}
     */
    function getMemberExpressionPath(node) {
        const parts = [];
        let current = node;
        let hasOptionalChaining = false;

        while (current) {
            if (current.type === 'MemberExpression') {
                if (current.optional) {
                    hasOptionalChaining = true;
                }
                if (current.computed) {
                    // Can't represent computed access in our path
                    return null;
                }
                if (current.property.type === 'Identifier') {
                    parts.unshift(current.property.name);
                } else {
                    return null;
                }
                current = current.object;
            } else if (current.type === 'Identifier') {
                parts.unshift(current.name);
                break;
            } else {
                return null;
            }
        }

        // Reconstruct the path with optional chaining if present
        if (hasOptionalChaining && parts.length > 1) {
            return parts[0] + '?.' + parts.slice(1).join('.');
        }
        return parts.join('.');
    }

    /**
     * Get the root object name from a member expression
     * @param {Node} node
     * @returns {string|null}
     */
    function getObjectName(node) {
        let current = node;
        while (current) {
            if (current.type === 'MemberExpression') {
                current = current.object;
            } else if (current.type === 'Identifier') {
                return current.name;
            } else {
                return null;
            }
        }
        return null;
    }

    /**
     * Get the identifier name from a dependency element
     * @param {Node} element
     * @returns {string|null}
     */
    function getDependencyName(element) {
        if (element.type === 'Identifier') {
            return element.name;
        }
        if (element.type === 'MemberExpression') {
            // This is already a narrowed dependency, get its root
            return getObjectName(element);
        }
        return null;
    }

    return {
        CallExpression(node) {
            if (!isReactHook(node)) {
                return;
            }

            const depsArray = getDependencyArray(node);
            if (!depsArray || depsArray.elements.length === 0) {
                return;
            }

            // Get the callback function (first argument for most hooks)
            const callback = node.arguments[0];
            if (!callback || (callback.type !== 'FunctionExpression' && callback.type !== 'ArrowFunctionExpression')) {
                return;
            }

            // Collect all member expressions and direct usages from the callback
            const memberExpressions = []; // Array to preserve source order
            const directUsages = new Set();
            const visited = new Set();
            collectMemberExpressions(callback.body, memberExpressions, directUsages, visited);

            // Check each dependency
            for (const depElement of depsArray.elements) {
                if (!depElement) {
                    continue;
                }

                // Only check simple identifiers (not member expressions)
                if (depElement.type !== 'Identifier') {
                    continue;
                }

                const depName = depElement.name;

                // Skip if this dependency is used directly (as a whole object)
                if (directUsages.has(depName)) {
                    continue;
                }

                // Find all leaf properties accessed from this dependency
                const accessedProperties = [];
                const seenProperties = new Set();
                
                for (const expr of memberExpressions) {
                    // Check if this expression starts with the dependency name
                    if (expr === depName) {
                        // Direct usage of the identifier as part of member expression chain
                        continue;
                    }
                    if (expr.startsWith(depName + '.') || expr.startsWith(depName + '?.')) {
                        // Only include if it's not a prefix of another already-added property
                        let isLeaf = true;
                        for (const existing of accessedProperties) {
                            if (existing.startsWith(expr + '.') || existing.startsWith(expr + '?.')) {
                                // This expr is a prefix of an existing one, skip it
                                isLeaf = false;
                                break;
                            }
                            if (expr.startsWith(existing + '.') || expr.startsWith(existing + '?.')) {
                                // Existing is a prefix of this one, we should replace it
                                // But we'll handle this by filtering at the end
                            }
                        }
                        
                        if (isLeaf && !seenProperties.has(expr)) {
                            seenProperties.add(expr);
                            accessedProperties.push(expr);
                        }
                    }
                }

                // Filter to keep only leaf properties (those that aren't prefixes of others)
                const leafProperties = accessedProperties.filter(prop => {
                    return !accessedProperties.some(other => 
                        other !== prop && (other.startsWith(prop + '.') || other.startsWith(prop + '?.'))
                    );
                });

                // If properties are accessed but the whole object is in deps, report
                if (leafProperties.length > 0) {
                    const propertiesList = leafProperties.join(', ');
                    context.report({
                        node: depElement,
                        messageId: 'narrowDependency',
                        data: {
                            dependency: depName,
                            properties: propertiesList,
                        },
                        fix(fixer) {
                            // Replace the broad dependency with specific properties
                            return fixer.replaceText(depElement, propertiesList);
                        },
                    });
                }
            }
        },
    };
}

export {meta, create};

