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
      "Enforce that React Context Providers do not mix data (state) and functions (actions) in the same context value. " +
      "Use separate context providers when you have both.",
    recommended: "error"
  },
  schema: [],
  messages: {
    contextMixesDataAndFunctions: CONST.MESSAGE.CONTEXT_MIXES_DATA_AND_FUNCTIONS
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

// Function-like identifier names (setters, handlers, etc.) - used for naming fallback
// eslint-disable-next-line max-len -- long regex for function-like identifier names
const FUNCTION_NAME_PATTERNS =
  /^(on|handle|set|get|is|has|can|should|do|create|update|delete|fetch|load|save|remove|add|toggle|clear|reset|submit|validate|format|parse|convert|transform|dispatch|register|unregister|open|close)/i;

/**
 * Check if a name looks like a function (setter, handler, etc.) based on naming convention.
 * @param {string} name - Identifier or property name
 * @returns {boolean}
 */
function looksLikeFunctionName(name) {
  return typeof name === "string" && FUNCTION_NAME_PATTERNS.test(name);
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
 * Check if a JSX element is any Context Provider (ends with Context.Provider)
 * @param {Node} node - JSX opening element node
 * @returns {boolean}
 */
function isAnyContextProvider(node) {
  const elementName = getJSXElementName(node);
  return elementName && elementName.includes("Context") && elementName.endsWith(".Provider");
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
 * Get the init node from a variable definition, including when the variable
 * comes from array or object destructuring (e.g. const [a, b] = useState()).
 * @param {Object} def - Variable definition from scope
 * @returns {Node|null}
 */
function getInitFromVariableDef(def) {
  if (!def || !def.node) {
    return null;
  }
  if (def.node.init) {
    return def.node.init;
  }
  // Destructuring: def.node is the pattern element (e.g. Identifier in array).
  // Walk up to the VariableDeclarator and use its init.
  let node = def.node;
  while (node && node.type !== "VariableDeclarator") {
    node = node.parent;
  }
  return node && node.init ? node.init : null;
}

/**
 * Check if a CallExpression is useState (useState or React.useState).
 * @param {Node} node - CallExpression node
 * @returns {boolean}
 */
function isUseStateCall(node) {
  if (!node || node.type !== "CallExpression") {
    return false;
  }
  const callee = node.callee;
  if (callee.type === "Identifier" && callee.name === "useState") {
    return true;
  }
  if (
    callee.type === "MemberExpression" &&
    callee.property &&
    callee.property.type === "Identifier" &&
    callee.property.name === "useState"
  ) {
    return true;
  }
  return false;
}

/**
 * Check if the given variable (from scope) is the setter from useState,
 * i.e. the second element of [state, setState] = useState().
 * @param {Object} variable - ESLint scope variable
 * @returns {boolean}
 */
function isUseStateSetterVariable(variable) {
  if (!variable || !variable.defs || variable.defs.length === 0) {
    return false;
  }
  const def = variable.defs[0];
  const init = getInitFromVariableDef(def);
  if (!init || !isUseStateCall(init)) {
    return false;
  }
  // Variable must be from array destructuring at index 1
  let patternNode = def.node;
  while (patternNode && patternNode.type !== "ArrayPattern") {
    patternNode = patternNode.parent;
  }
  if (!patternNode || patternNode.type !== "ArrayPattern") {
    return false;
  }
  const elements = patternNode.elements;
  const index = elements.indexOf(def.node);
  return index === 1;
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
        const init = getInitFromVariableDef(variable.defs[0]);
        if (init) {
          return init;
        }
      }
    }
    currentScope = currentScope.upper;
  }

  return null;
}

/**
 * Get the scope variable for an identifier (for useState setter check).
 * @param {Object} context - ESLint rule context
 * @param {Node} node - Current AST node for scope resolution
 * @param {string} identifierName - Name of the identifier to find
 * @returns {Object|null} - Scope variable or null
 */
function findScopeVariable(context, node, identifierName) {
  const sourceCode = context.sourceCode || context.getSourceCode();
  const scope = sourceCode.getScope(node);
  let currentScope = scope;

  while (currentScope) {
    for (const variable of currentScope.variables) {
      if (variable.name === identifierName) {
        return variable;
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
    // Only substitute the declaration when we can classify it directly (function or data).
    // Do not substitute when declaration is useState() CallExpression - we need the Identifier
    // to resolve the scope variable and detect useState setter (second array element).
    if (prop.shorthand && prop.key && prop.key.type === "Identifier") {
      const declaration = findVariableDeclaration(context, objectNode, prop.key.name);
      if (declaration && (isFunctionValue(declaration) || isDataValue(declaration))) {
        valueNode = declaration;
      }
    }

    if (isFunctionValue(valueNode)) {
      result.hasFunctions = true;
      result.functionProps.push(propName);
    } else if (valueNode && valueNode.type === "Identifier") {
      // For identifiers, try to resolve them
      const scopeVariable = findScopeVariable(context, objectNode, valueNode.name);
      const declaration = findVariableDeclaration(context, objectNode, valueNode.name);

      if (scopeVariable && isUseStateSetterVariable(scopeVariable)) {
        // React useState setter (e.g. setSplashScreenState from [state, setSplashScreenState] = useState())
        result.hasFunctions = true;
        result.functionProps.push(propName);
      } else if (declaration && isFunctionValue(declaration)) {
        result.hasFunctions = true;
        result.functionProps.push(propName);
      } else if (declaration && isDataValue(declaration)) {
        result.hasNonFunctions = true;
        result.nonFunctionProps.push(propName);
      } else {
        // Can't determine, assume based on naming convention
        if (looksLikeFunctionName(valueNode.name)) {
          result.hasFunctions = true;
          result.functionProps.push(propName);
        } else {
          result.hasNonFunctions = true;
          result.nonFunctionProps.push(propName);
        }
      }
    } else if (valueNode && valueNode.type === "MemberExpression") {
      // e.g. setSplashScreenState: ref.current.setSplashScreenState or stateSetters.setSplashScreenState
      const propIdentifier =
        valueNode.property && valueNode.property.type === "Identifier" ? valueNode.property.name : null;
      if (propIdentifier && looksLikeFunctionName(propIdentifier)) {
        result.hasFunctions = true;
        result.functionProps.push(propName);
      } else {
        result.hasNonFunctions = true;
        result.nonFunctionProps.push(propName);
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
      // Only enforce: do not mix data and functions in the same context value.
      // No naming convention is enforced.
      if (!isAnyContextProvider(node)) {
        return;
      }

      const valueProp = getValueProp(node.attributes);
      if (!valueProp) {
        return;
      }

      let objectToAnalyze = valueProp;
      if (valueProp.type === "Identifier") {
        const declaration = findVariableDeclaration(context, node, valueProp.name);
        if (declaration) {
          objectToAnalyze = declaration;
        }
      }

      if (objectToAnalyze.type !== "ObjectExpression") {
        return; // Single value (no object) cannot "mix" - allow
      }

      const analysis = analyzeObjectProperties(objectToAnalyze, context);
      const mixed = analysis.hasFunctions && analysis.hasNonFunctions;

      if (mixed) {
        context.report({
          node,
          messageId: "contextMixesDataAndFunctions",
          data: {
            contextName: getJSXElementName(node)
          }
        });
      }
    }
  };
}

export { name, meta, create };
