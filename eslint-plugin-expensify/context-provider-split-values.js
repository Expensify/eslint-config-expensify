/**
 * ESLint rule: context-provider-split-values
 *
 * Enforces that React Context Providers follow a split pattern where:
 * 1. All context providers must be named either *StateContext or *ActionsContext
 * 2. State context values contain only data (non-function values)
 * 3. Actions context values contain only methods (functions)
 *
 * Good pattern:
 * <StateContext.Provider value={stateContextValue}>
 *   <ActionsContext.Provider value={actionsContextValue}>
 *     {children}
 *   </ActionsContext.Provider>
 * </StateContext.Provider>
 *
 * Where stateContextValue = { someData, someArray, someObject }
 * And actionsContextValue = { doSomething, handleEvent, updateData }
 *
 * Bad pattern (will be flagged):
 * <MyContext.Provider value={mixedValue}>  // Should be split into State and Actions
 */
import _ from "lodash";
import CONST from "./CONST.js";

const name = "context-provider-split-values";

const meta = {
  type: "suggestion",
  docs: {
    description:
      "Enforce separation of state and actions in React Context Providers. " +
      "All contexts must be named *StateContext or *ActionsContext. " +
      "State contexts should only contain data, Actions contexts should only contain functions.",
    recommended: "error"
  },
  schema: [],
  messages: {
    stateContextHasFunction: CONST.MESSAGE.STATE_CONTEXT_HAS_FUNCTION,
    actionsContextHasNonFunction: CONST.MESSAGE.ACTIONS_CONTEXT_HAS_NON_FUNCTION,
    contextMustBeSplit: CONST.MESSAGE.CONTEXT_MUST_BE_SPLIT
  }
};

/**
 * Check if a node represents a function value
 * @param {Node} node - AST node to check
 * @returns {boolean}
 */
function isFunctionValue(node) {
  if (!node) {
    return false;
  }

  // Direct function expressions
  if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
    return true;
  }

  // Identifiers that reference functions need to be checked differently
  // For this rule, we assume identifiers follow naming conventions
  return false;
}

/**
 * Check if a node represents a non-function data value
 * @param {Node} node - AST node to check
 * @returns {boolean}
 */
function isDataValue(node) {
  if (!node) {
    return false;
  }

  // Primitive literals
  if (node.type === "Literal") {
    return true;
  }

  // Array expressions
  if (node.type === "ArrayExpression") {
    return true;
  }

  // Object expressions (need to check properties)
  if (node.type === "ObjectExpression") {
    return true;
  }

  // Template literals
  if (node.type === "TemplateLiteral") {
    return true;
  }

  return false;
}

/**
 * Get the full name of a JSX element
 * @param {Node} node - JSX opening element node
 * @returns {string|null}
 */
function getJSXElementName(node) {
  if (!node || !node.name) {
    return null;
  }

  // Handle JSXMemberExpression: e.g., StateContext.Provider
  if (node.name.type === "JSXMemberExpression") {
    const parts = [];
    let current = node.name;
    while (current) {
      if (current.type === "JSXMemberExpression") {
        if (current.property && current.property.name) {
          parts.unshift(current.property.name);
        }
        current = current.object;
      } else if (current.type === "JSXIdentifier") {
        parts.unshift(current.name);
        break;
      } else {
        break;
      }
    }
    return parts.join(".");
  }

  // Handle simple JSXIdentifier
  if (node.name.type === "JSXIdentifier") {
    return node.name.name;
  }

  return null;
}

/**
 * Check if a JSX element is a Context Provider with "State" in the name
 * @param {Node} node - JSX opening element node
 * @returns {boolean}
 */
function isStateContextProvider(node) {
  const elementName = getJSXElementName(node);
  return (
    elementName && elementName.includes("State") && elementName.includes("Context") && elementName.includes("Provider")
  );
}

/**
 * Check if a JSX element is a Context Provider with "Actions" in the name
 * @param {Node} node - JSX opening element node
 * @returns {boolean}
 */
function isActionsContextProvider(node) {
  const elementName = getJSXElementName(node);
  return (
    elementName &&
    elementName.includes("Actions") &&
    elementName.includes("Context") &&
    elementName.includes("Provider")
  );
}

/**
 * Check if a JSX element is any Context Provider (ends with Context.Provider)
 * @param {Node} node - JSX opening element node
 * @returns {boolean}
 */
function isAnyContextProvider(node) {
  const elementName = getJSXElementName(node);
  return elementName && elementName.includes("Context") && elementName.endsWith(".Provider");
}

/**
 * Check if a JSX element is a generic Context Provider (not State or Actions)
 * @param {Node} node - JSX opening element node
 * @returns {boolean}
 */
function isGenericContextProvider(node) {
  return isAnyContextProvider(node) && !isStateContextProvider(node) && !isActionsContextProvider(node);
}

/**
 * Find the value prop from JSX attributes
 * @param {Array} attributes - JSX attributes array
 * @returns {Node|null}
 */
function getValueProp(attributes) {
  if (!attributes) {
    return null;
  }

  const valueProp = _.find(attributes, attr => attr.type === "JSXAttribute" && attr.name && attr.name.name === "value");

  if (valueProp && valueProp.value) {
    // Handle JSXExpressionContainer: value={something}
    if (valueProp.value.type === "JSXExpressionContainer") {
      return valueProp.value.expression;
    }
    return valueProp.value;
  }

  return null;
}

/**
 * Find the variable declaration for an identifier in the current scope
 * @param {Object} context - ESLint rule context
 * @param {Node} node - Current AST node for scope resolution
 * @param {string} identifierName - Name of the identifier to find
 * @returns {Node|null}
 */
function findVariableDeclaration(context, node, identifierName) {
  // ESLint 9 uses context.sourceCode.getScope(node) instead of context.getScope()
  const sourceCode = context.sourceCode || context.getSourceCode();
  const scope = sourceCode.getScope(node);
  let currentScope = scope;

  while (currentScope) {
    for (const variable of currentScope.variables) {
      if (variable.name === identifierName) {
        const def = variable.defs[0];
        if (def && def.node && def.node.init) {
          return def.node.init;
        }
      }
    }
    currentScope = currentScope.upper;
  }

  return null;
}

/**
 * Check properties of an object expression to see if they contain functions or data
 * @param {Node} objectNode - ObjectExpression node
 * @param {Object} context - ESLint rule context
 * @param {Set} visited - Set of visited nodes to prevent infinite recursion
 * @returns {{hasFunctions: boolean, hasNonFunctions: boolean, functionProps: string[], nonFunctionProps: string[]}}
 */
function analyzeObjectProperties(objectNode, context, visited = new Set()) {
  const result = {
    hasFunctions: false,
    hasNonFunctions: false,
    functionProps: [],
    nonFunctionProps: []
  };

  if (!objectNode || objectNode.type !== "ObjectExpression") {
    return result;
  }

  // Prevent infinite recursion
  if (visited.has(objectNode)) {
    return result;
  }
  visited.add(objectNode);

  for (const prop of objectNode.properties) {
    // Handle spread elements: { ...otherObject }
    if (prop.type === "SpreadElement") {
      const spreadArg = prop.argument;
      let spreadObject = spreadArg;

      // If it's an identifier, try to resolve it
      if (spreadArg && spreadArg.type === "Identifier") {
        const declaration = findVariableDeclaration(context, objectNode, spreadArg.name);
        if (declaration) {
          spreadObject = declaration;
        }
      }

      // Recursively analyze the spread object
      if (spreadObject && spreadObject.type === "ObjectExpression") {
        const spreadAnalysis = analyzeObjectProperties(spreadObject, context, visited);
        if (spreadAnalysis.hasFunctions) {
          result.hasFunctions = true;
          result.functionProps.push(...spreadAnalysis.functionProps);
        }
        if (spreadAnalysis.hasNonFunctions) {
          result.hasNonFunctions = true;
          result.nonFunctionProps.push(...spreadAnalysis.nonFunctionProps);
        }
      }
      continue;
    }

    const propName = prop.key ? prop.key.name || prop.key.value || "unknown" : "unknown";
    let valueNode = prop.value;

    // Handle shorthand properties: { foo } means { foo: foo }
    if (prop.shorthand && prop.key && prop.key.type === "Identifier") {
      // Try to find the variable declaration
      const declaration = findVariableDeclaration(context, objectNode, prop.key.name);
      if (declaration) {
        valueNode = declaration;
      }
    }

    if (isFunctionValue(valueNode)) {
      result.hasFunctions = true;
      result.functionProps.push(propName);
    } else if (valueNode && valueNode.type === "Identifier") {
      // For identifiers, try to resolve them
      const declaration = findVariableDeclaration(context, objectNode, valueNode.name);
      if (declaration && isFunctionValue(declaration)) {
        result.hasFunctions = true;
        result.functionProps.push(propName);
      } else if (declaration && isDataValue(declaration)) {
        result.hasNonFunctions = true;
        result.nonFunctionProps.push(propName);
      } else {
        // Can't determine, assume based on naming convention
        // Functions typically start with verbs or common patterns
        const valueName = valueNode.name;
        // eslint-disable-next-line max-len -- long regex for function-like identifier names
        const functionPatterns =
          /^(on|handle|set|get|is|has|can|should|do|create|update|delete|fetch|load|save|remove|add|toggle|clear|reset|submit|validate|format|parse|convert|transform|dispatch|register|unregister|open|close)/i;
        if (functionPatterns.test(valueName)) {
          result.hasFunctions = true;
          result.functionProps.push(propName);
        } else {
          result.hasNonFunctions = true;
          result.nonFunctionProps.push(propName);
        }
      }
    } else if (valueNode) {
      result.hasNonFunctions = true;
      result.nonFunctionProps.push(propName);
    }
  }

  return result;
}

function create(context) {
  return {
    JSXOpeningElement(node) {
      const elementName = getJSXElementName(node);

      // Check if this is a generic context provider (not State or Actions)
      // These should be split into separate State and Actions contexts
      if (isGenericContextProvider(node)) {
        context.report({
          node,
          messageId: "contextMustBeSplit",
          data: {
            contextName: elementName
          }
        });
        return; // No need to check further for generic contexts
      }

      // Check if this is a State context provider
      if (isStateContextProvider(node)) {
        const valueProp = getValueProp(node.attributes);

        if (!valueProp) {
          return;
        }

        let objectToAnalyze = valueProp;

        // If value is an identifier, try to find its declaration
        if (valueProp.type === "Identifier") {
          const declaration = findVariableDeclaration(context, node, valueProp.name);
          if (declaration) {
            objectToAnalyze = declaration;
          }
        }

        // Analyze the object properties
        if (objectToAnalyze.type === "ObjectExpression") {
          const analysis = analyzeObjectProperties(objectToAnalyze, context);

          if (analysis.hasFunctions && analysis.functionProps.length > 0) {
            context.report({
              node,
              messageId: "stateContextHasFunction",
              data: {
                contextName: elementName,
                properties: analysis.functionProps.join(", ")
              }
            });
          }
        }
      }

      // Check if this is an Actions context provider
      if (isActionsContextProvider(node)) {
        const valueProp = getValueProp(node.attributes);

        if (!valueProp) {
          return;
        }

        let objectToAnalyze = valueProp;

        // If value is an identifier, try to find its declaration
        if (valueProp.type === "Identifier") {
          const declaration = findVariableDeclaration(context, node, valueProp.name);
          if (declaration) {
            objectToAnalyze = declaration;
          }
        }

        // Analyze the object properties
        if (objectToAnalyze.type === "ObjectExpression") {
          const analysis = analyzeObjectProperties(objectToAnalyze, context);

          if (analysis.hasNonFunctions && analysis.nonFunctionProps.length > 0) {
            context.report({
              node,
              messageId: "actionsContextHasNonFunction",
              data: {
                contextName: elementName,
                properties: analysis.nonFunctionProps.join(", ")
              }
            });
          }
        }
      }
    }
  };
}

export { name, meta, create };
