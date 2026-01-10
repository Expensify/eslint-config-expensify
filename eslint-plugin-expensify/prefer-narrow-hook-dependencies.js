/* eslint-disable rulesdir/prefer-underscore-method */
/**
 * ESLint rule: prefer-narrow-hook-dependencies
 *
 * Enforces narrowing down React hook dependency arrays to specific properties
 * instead of entire objects for better performance and clarity.
 *
 * Configuration:
 * You can customize which objects are considered "stable" (and thus excluded from narrowing)
 * by providing a `stableObjectPatterns` array in your ESLint config:
 *
 * @example
 * {
 *   "rules": {
 *     "rulesdir/prefer-narrow-hook-dependencies": ["error", {
 *       "stableObjectPatterns": ["^styles?$", "^theme$", "^config$"]
 *     }]
 *   }
 * }
 */
const name = 'prefer-narrow-hook-dependencies';

const meta = {
    type: 'suggestion',
    docs: {
        description:
      'Enforce narrowing down React hook dependency arrays to specific properties instead of entire objects',
        recommended: 'error',
    },
    fixable: 'code',
    schema: [
        {
            type: 'object',
            properties: {
                stableObjectPatterns: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                    description: 'Array of regex pattern strings for stable objects that should not be narrowed (e.g., "^styles?$", "^theme$")',
                },
            },
            additionalProperties: false,
        },
    ],
    messages: {
        narrowDependency:
      'Dependency "{{dependency}}" is too broad. Use specific properties instead: {{properties}}',
    },
};

/**
 * Built-in React hooks that have dependency arrays. Skipping useImperativeHandle because its dependency array is rarely used.
 */
const HOOKS_WITH_DEPS = new Set([
    'useEffect',
    'useLayoutEffect',
    'useCallback',
    'useMemo',
]);

/**
 * Check if a dependency name matches stable object patterns
 * @param {string} depName
 * @param {Array<RegExp>} patterns
 * @returns {boolean}
 */
function isStableObjectPattern(depName, patterns) {
    return patterns.some(pattern => pattern.test(depName));
}

/**
 * Check if an object has .current property accessed (indicates it's likely a ref)
 * @param {string} depName
 * @param {Set<string>} memberExpressions
 * @returns {boolean}
 */
function hasCurrentPropertyAccess(depName, memberExpressions) {
    const currentAccessPattern = `${depName}.current`;

    for (const expr of memberExpressions) {
        if (expr.startsWith(currentAccessPattern)) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a call expression is a React hook that has a dependency array
 * @param {CallExpression} node
 * @returns {boolean}
 */
function isReactHook(node) {
    return (
        node.type === 'CallExpression'
    && node.callee.type === 'Identifier'
    && HOOKS_WITH_DEPS.has(node.callee.name)
    );
}

/**
 * Get the dependency array from a React hook call
 * @param {CallExpression} hookCall
 * @returns {ArrayExpression|null}
 */
function getDependencyArray(hookCall) {
    const depArray = hookCall.arguments[1];

    if (!depArray || depArray.type !== 'ArrayExpression') {
        return null;
    }

    return depArray;
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
 * Get the full path of a member expression as a string
 * @param {MemberExpression} node
 * @returns {string|null}
 */
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
 * Generic AST traversal - visit all child nodes
 * @param {Node} node
 * @param {Function} visitor - Called for each node
 * @param {Set<Node>} visited
 */
function traverseAST(node, visitor, visited = new Set()) {
    if (!node || !node.type || visited.has(node)) {
        return;
    }

    visited.add(node);
    visitor(node);

    // Generic traversal: visit all properties that contain AST nodes
    for (const key of Object.keys(node)) {
        // Skip metadata and parent references to avoid cycles
        if (key === 'parent' || key === 'type' || key === 'range' || key === 'loc') {
            continue;
        }

        const value = node[key];

        if (Array.isArray(value)) {
            for (const item of value) {
                if (item && typeof item === 'object' && item.type) {
                    traverseAST(item, visitor, visited);
                }
            }
        } else if (value && typeof value === 'object' && value.type) {
            traverseAST(value, visitor, visited);
        }
    }
}

/**
 * Collect all member expressions and direct usages from a node
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
    traverseAST(node, (currentNode) => {
        // Handle member expressions
        if (currentNode.type === 'MemberExpression') {
            // Method call: obj.method() - object is used as a whole
            if (
                currentNode.parent
                && currentNode.parent.type === 'CallExpression'
                && currentNode.parent.callee === currentNode
            ) {
                const objectName = getObjectName(currentNode);
                if (objectName) {
                    directUsages.add(objectName);
                }
                return;
            }

            // Computed access: obj[key] - object is used as a whole
            if (currentNode.computed) {
                const objectName = getObjectName(currentNode.object);
                if (objectName) {
                    directUsages.add(objectName);
                }
                return;
            }

            // Regular property access: collect the full path
            const fullPath = getMemberExpressionPath(currentNode);
            if (fullPath) {
                memberExpressions.add(fullPath);
            }
        }

        // Handle direct identifier usage
        if (currentNode.type === 'Identifier' && currentNode.parent) {
            const parent = currentNode.parent;

            // Skip property names in member expressions (e.g., "name" in user.name)
            if (
                parent.type === 'MemberExpression'
                && parent.property === currentNode
                && !parent.computed
            ) {
                return;
            }

            // Skip objects in member expressions (e.g., "user" in user.name)
            if (parent.type === 'MemberExpression' && parent.object === currentNode) {
                return;
            }

            // Direct usage (function argument, return value, etc.)
            directUsages.add(currentNode.name);
        }

        // Spread operator: {...obj} - whole object is needed
        if (currentNode.type === 'SpreadElement') {
            if (currentNode.argument && currentNode.argument.type === 'Identifier') {
                directUsages.add(currentNode.argument.name);
            }
        }

        // JSX spread: <Component {...props} /> - whole object is needed
        if (currentNode.type === 'JSXSpreadAttribute') {
            if (currentNode.argument && currentNode.argument.type === 'Identifier') {
                directUsages.add(currentNode.argument.name);
            }
        }

        // Iteration: for...of / for...in - whole collection is needed
        if (currentNode.type === 'ForOfStatement' || currentNode.type === 'ForInStatement') {
            if (currentNode.right && currentNode.right.type === 'Identifier') {
                directUsages.add(currentNode.right.name);
            }
        }
    }, visited);
}

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

function create(context) {
    // Get user configuration
    const options = context.options[0] || {};
    const patternStrings = options.stableObjectPatterns || [];

    // Convert pattern strings to RegExp objects
    const stableObjectPatterns = patternStrings.map(pattern => new RegExp(pattern));

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
            if (!callback
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

                // Skip if this matches a stable object pattern (styles, theme, etc.)
                if (isStableObjectPattern(depName, stableObjectPatterns)) {
                    continue;
                }

                // Skip if this is a ref (has .current property accessed)
                if (hasCurrentPropertyAccess(depName, memberExpressions)) {
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
