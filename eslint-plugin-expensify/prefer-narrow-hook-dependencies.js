/* eslint-disable rulesdir/prefer-underscore-method */
/* eslint-disable no-continue */
const name = 'prefer-narrow-hook-dependencies';

const meta = {
    type: 'suggestion',
    docs: {
        description:
      'Enforce narrowing down React hook dependency arrays to specific properties instead of entire objects',
        recommended: 'warn',
    },
    fixable: 'code',
    schema: [],
    messages: {
        narrowDependency:
      'Dependency "{{dependency}}" is too broad. Use specific properties instead: {{properties}}',
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

    function getMemberExpressionPath(node) {
        const parts = [];
        let current = node;

        while (current) {
            if (current.type === 'MemberExpression') {
                if (current.computed) {
                    // Can't represent computed access in our path
                    return null;
                }
                if (current.property.type === 'Identifier') {
                    // Track if this specific member access is optional
                    parts.unshift({
                        name: current.property.name,
                        optional: current.optional || false,
                    });
                } else {
                    return null;
                }
                current = current.object;
            } else if (current.type === 'Identifier') {
                parts.unshift({
                    name: current.name,
                    optional: false,
                });
                break;
            } else {
                return null;
            }
        }

        // Reconstruct the path with optional chaining at each level
        if (parts.length === 0) {
            return null;
        }

        let result = parts[0].name;
        for (let i = 1; i < parts.length; i++) {
            const separator = parts[i].optional ? '?.' : '.';
            result += separator + parts[i].name;
        }

        return result;
    }

    /**
   * Recursively collect all member expressions and direct usages from a node using ESLint traversal
   * @param {Node} node
   * @param {Set<string>} memberExpressions - Set for O(1) deduplication
   * @param {Set<string>} directUsages
   * @param {Set<Node>} visited
   */
    function collectMemberExpressions(
        node,
        memberExpressions,
        directUsages,
        visited = new Set(),
    ) {
        if (!node || !node.type || visited.has(node)) {
            return;
        }

        visited.add(node);

        // If this is a member expression, process it
        if (node.type === 'MemberExpression') {
            // Check if this member expression is the callee of a function call
            // If so, the object is being used as a whole (for its method)
            if (
                node.parent
        && node.parent.type === 'CallExpression'
        && node.parent.callee === node
            ) {
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
                if (fullPath) {
                    memberExpressions.add(fullPath); // O(1) deduplication with Set
                }
            }

            // Don't return - continue to traverse children
        }

        // If identifier is used directly (not part of a member expression), mark as direct usage
        if (node.type === 'Identifier' && node.parent) {
            const parent = node.parent;

            // Skip if this is a property name in non-computed member access (like "name" in user.name)
            if (
                parent.type === 'MemberExpression'
        && parent.property === node
        && !parent.computed
            ) {
                return;
            }

            // Skip if this is the object in a member expression (like "user" in user.name)
            // The MemberExpression case above handles property access tracking
            if (parent.type === 'MemberExpression' && parent.object === node) {
                return;
            }

            // Otherwise, it's a direct usage (e.g., function argument, return value, etc.)
            directUsages.add(node.name);
        }

        // Carefully traverse specific child nodes to avoid circular references
        if (node.type === 'MemberExpression') {
            collectMemberExpressions(
                node.object,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (node.type === 'ChainExpression') {
            // Optional chaining is wrapped in ChainExpression
            collectMemberExpressions(
                node.expression,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (node.type === 'CallExpression') {
            collectMemberExpressions(
                node.callee,
                memberExpressions,
                directUsages,
                visited,
            );
            if (node.arguments) {
                for (const arg of node.arguments) {
                    collectMemberExpressions(
                        arg,
                        memberExpressions,
                        directUsages,
                        visited,
                    );
                }
            }
        } else if (node.type === 'BlockStatement' || node.type === 'Program') {
            if (node.body) {
                for (const statement of node.body) {
                    collectMemberExpressions(
                        statement,
                        memberExpressions,
                        directUsages,
                        visited,
                    );
                }
            }
        } else if (node.type === 'ExpressionStatement') {
            collectMemberExpressions(
                node.expression,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (node.type === 'ReturnStatement') {
            collectMemberExpressions(
                node.argument,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (node.type === 'IfStatement') {
            collectMemberExpressions(
                node.test,
                memberExpressions,
                directUsages,
                visited,
            );
            collectMemberExpressions(
                node.consequent,
                memberExpressions,
                directUsages,
                visited,
            );
            collectMemberExpressions(
                node.alternate,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (
            node.type === 'BinaryExpression'
      || node.type === 'LogicalExpression'
        ) {
            collectMemberExpressions(
                node.left,
                memberExpressions,
                directUsages,
                visited,
            );
            collectMemberExpressions(
                node.right,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (node.type === 'UnaryExpression') {
            collectMemberExpressions(
                node.argument,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (node.type === 'ConditionalExpression') {
            collectMemberExpressions(
                node.test,
                memberExpressions,
                directUsages,
                visited,
            );
            collectMemberExpressions(
                node.consequent,
                memberExpressions,
                directUsages,
                visited,
            );
            collectMemberExpressions(
                node.alternate,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (node.type === 'SpreadElement') {
            // Spread operator means the whole object is needed: {...obj}
            if (node.argument && node.argument.type === 'Identifier') {
                directUsages.add(node.argument.name);
            }
            collectMemberExpressions(
                node.argument,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (node.type === 'ObjectExpression') {
            // Traverse object literals to find spread or property values
            if (node.properties) {
                for (const prop of node.properties) {
                    collectMemberExpressions(
                        prop,
                        memberExpressions,
                        directUsages,
                        visited,
                    );
                }
            }
        } else if (node.type === 'Property') {
            // Handle both key and value in object properties
            collectMemberExpressions(
                node.value,
                memberExpressions,
                directUsages,
                visited,
            );
        } else if (node.type === 'ArrayExpression') {
            // Traverse array literals
            if (node.elements) {
                for (const element of node.elements) {
                    collectMemberExpressions(
                        element,
                        memberExpressions,
                        directUsages,
                        visited,
                    );
                }
            }
        } else if (
            node.type === 'ArrowFunctionExpression'
      || node.type === 'FunctionExpression'
        ) {
            // Don't traverse into nested functions - they have their own scope

        }
    }

    /**
   * Get the full path of a member expression as a string
   * @param {MemberExpression} node
   * @returns {string|null}
   */

    /**
   * Extract only leaf properties (those that aren't prefixes of other properties)
   * Optimized O(n log n) approach using sorting, preserving original order
   * @param {Array<string>} properties
   * @returns {Array<string>}
   */
    function getLeafProperties(properties) {
        if (properties.length === 0) {
            return properties;
        }

        // Create a sorted copy by length to efficiently detect prefixes
        const sortedByLength = [...properties].sort((a, b) => a.length - b.length);
        const prefixes = new Set();

        // Build set of all strings that are prefixes of longer strings
        for (let i = 0; i < sortedByLength.length; i++) {
            const current = sortedByLength[i];
            for (let j = i + 1; j < sortedByLength.length; j++) {
                const longer = sortedByLength[j];
                if (
                    longer.startsWith(`${current}.`)
          || longer.startsWith(`${current}?.`)
                ) {
                    prefixes.add(current);
                    break; // No need to check further
                }
            }
        }

        // Filter original array to preserve source order
        return properties.filter(prop => !prefixes.has(prop));
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
            if (
                !callback
        || (callback.type !== 'FunctionExpression'
          && callback.type !== 'ArrowFunctionExpression')
            ) {
                return;
            }

            // Collect all member expressions and direct usages from the callback
            const memberExpressions = new Set(); // Set for O(1) deduplication
            const directUsages = new Set();
            const visited = new Set();
            collectMemberExpressions(
                callback.body,
                memberExpressions,
                directUsages,
                visited,
            );

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

                // Cache string concatenations for performance
                const depWithDot = `${depName}.`;
                const depWithOptional = `${depName}?.`;

                // Find all properties accessed from this dependency
                const accessedProperties = [];
                for (const expr of memberExpressions) {
                    // Check if this expression starts with the dependency name
                    if (expr === depName) {
                        continue; // Direct usage of the identifier
                    }
                    if (expr.startsWith(depWithDot) || expr.startsWith(depWithOptional)) {
                        accessedProperties.push(expr);
                    }
                }

                // Extract only leaf properties (optimized O(n log n))
                const leafProperties = getLeafProperties(accessedProperties);

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

export {name, meta, create};
