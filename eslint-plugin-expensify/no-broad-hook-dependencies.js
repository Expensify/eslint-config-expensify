import CONST from "./CONST.js";

const message = CONST.MESSAGE.NO_BROAD_HOOK_DEPENDENCIES;

const HOOKS_TO_CHECK = [
  "useEffect",
  "useLayoutEffect",
  "useMemo",
  "useCallback",
];

function create(context) {
  /**
   * Recursively collects all member expressions accessed in the given node
   * For example, for code like `transactionItem.isAmountColumnWide`, this returns:
   * { 'transactionItem': Set(['isAmountColumnWide']) }
   *
   * @param {ASTNode} node - The AST node to traverse
   * @param {Object} accesses - Accumulator object mapping object names to sets of accessed properties
   * @param {Set} visited - Set of visited nodes to prevent infinite recursion
   * @returns {Object} The accesses object
   */
  function collectMemberAccesses(node, accesses = {}, visited = new Set()) {
    if (!node || visited.has(node)) {
      return accesses;
    }

    visited.add(node);

    // If this is a member expression like obj.prop or obj.prop.nested
    // but NOT computed member expressions like obj['computed'] or obj[variable]
    if (node.type === "MemberExpression" && !node.computed) {
      // Skip method calls - accessing obj.method() doesn't mean you should depend on obj.method,
      // you should depend on obj itself. Only track property accesses, not method calls.
      if (
        node.parent &&
        node.parent.type === "CallExpression" &&
        node.parent.callee === node
      ) {
        return accesses;
      }

      // Get the root object name (e.g., 'transactionItem' from 'transactionItem.isAmountColumnWide')
      const rootObject = getRootObjectName(node);

      if (rootObject) {
        // Get the full property path (e.g., 'isAmountColumnWide' or 'profile.name')
        const propertyPath = getPropertyPath(node);

        if (!accesses[rootObject]) {
          accesses[rootObject] = new Set();
        }
        accesses[rootObject].add(propertyPath);
      }
    }

    // Recursively traverse all child nodes
    const keys = Object.keys(node);
    for (const key of keys) {
      // Skip certain keys that can cause circular references or aren't useful
      if (key === "parent" || key === "loc" || key === "range") {
        continue;
      }

      const child = node[key];

      if (Array.isArray(child)) {
        child.forEach((item) => {
          if (item && typeof item === "object" && item.type) {
            collectMemberAccesses(item, accesses, visited);
          }
        });
      } else if (child && typeof child === "object" && child.type) {
        collectMemberAccesses(child, accesses, visited);
      }
    }

    return accesses;
  }

  /**
   * Gets the root object name from a member expression
   * For 'transactionItem.isAmountColumnWide', returns 'transactionItem'
   * For 'user.profile.name', returns 'user'
   *
   * @param {ASTNode} node - A MemberExpression node
   * @returns {string|null} The root object name or null
   */
  function getRootObjectName(node) {
    let current = node;

    // Traverse to the leftmost identifier
    while (current.type === "MemberExpression") {
      current = current.object;
    }

    if (current.type === "Identifier") {
      return current.name;
    }

    return null;
  }

  /**
   * Gets the full property path from a member expression
   * For 'obj.prop', returns 'prop'
   * For 'obj.profile.name', returns 'profile.name'
   *
   * @param {ASTNode} node - A MemberExpression node
   * @returns {string} The property path
   */
  function getPropertyPath(node) {
    const parts = [];
    let current = node;

    while (current.type === "MemberExpression") {
      if (current.property.type === "Identifier") {
        parts.unshift(current.property.name);
      } else if (current.property.type === "Literal") {
        parts.unshift(current.property.value);
      }
      current = current.object;
    }

    return parts.join(".");
  }

  /**
   * Extracts dependency identifiers from the dependency array
   * Returns an object mapping each dependency type to its node
   *
   * @param {ASTNode} depsArray - The dependency array expression node
   * @returns {Object} Object with 'identifiers' (simple deps) and 'memberExpressions' (property deps)
   */
  function extractDependencies(depsArray) {
    const identifiers = []; // Simple identifiers like 'obj'
    const memberExpressions = []; // Member expressions like 'obj.prop'

    if (!depsArray || depsArray.type !== "ArrayExpression") {
      return { identifiers, memberExpressions };
    }

    depsArray.elements.forEach((element) => {
      if (!element) {
        return;
      }

      if (element.type === "Identifier") {
        identifiers.push(element);
      } else if (element.type === "MemberExpression") {
        memberExpressions.push(element);
      }
    });

    return { identifiers, memberExpressions };
  }

  /**
   * Checks if a hook call has overly broad dependencies
   *
   * @param {ASTNode} node - The CallExpression node for the hook
   */
  function checkHookDependencies(node) {
    // Hook calls should have at least 2 arguments (callback and deps array)
    if (node.arguments.length < 2) {
      return;
    }

    const callback = node.arguments[0];
    const depsArray = node.arguments[1];

    // Only check if callback is a function
    if (
      !callback ||
      (callback.type !== "ArrowFunctionExpression" &&
        callback.type !== "FunctionExpression")
    ) {
      return;
    }

    // Collect all member accesses in the callback body
    const accesses = collectMemberAccesses(callback.body);

    // Extract dependencies from the array
    const { identifiers, memberExpressions } = extractDependencies(depsArray);

    // Build a set of root objects that have member expressions in deps
    const depsWithSpecificProperties = new Set();
    memberExpressions.forEach((memberExpr) => {
      const rootName = getRootObjectName(memberExpr);
      if (rootName) {
        depsWithSpecificProperties.add(rootName);
      }
    });

    // Check each identifier dependency
    identifiers.forEach((identifierNode) => {
      const depName = identifierNode.name;

      // If this object is accessed with properties in the callback
      // but the dependency is just the bare object
      if (accesses[depName] && accesses[depName].size > 0) {
        // Skip if there are already specific property dependencies for this object
        if (depsWithSpecificProperties.has(depName)) {
          return;
        }

        // Report the issue
        context.report({
          node: identifierNode,
          message,
        });
      }
    });
  }

  return {
    CallExpression(node) {
      // Check if this is a call to one of the hooks we're interested in
      if (
        node.callee.type === "Identifier" &&
        HOOKS_TO_CHECK.includes(node.callee.name)
      ) {
        checkHookDependencies(node);
      }
    },
  };
}

export { create };
