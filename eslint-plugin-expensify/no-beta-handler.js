module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow custom functions that check for beta features using `betas?.includes(CONST.BETAS.BETA_NAME)`. Suggests using `isBetaEnabled` instead.',
        },
        fixable: null,
        schema: [],
        messages: {
            useIsBetaEnabled: "Avoid creating custom beta checker functions (e.g., '{{ functionName }}'). Use `isBetaEnabled` utility method instead for checking beta features.",
        },
    },

    create(context) {
        /**
         * Checks if a given AST node is a call to `array?.includes('beta')`.
         * @param {ASTNode} node The AST node to check.
         * @returns {boolean} True if the node is a beta includes call, false otherwise.
         */
        function isBetaIncludesCall(node) {
            // Ensure it's a CallExpression (e.g., func(...))
            if (node.type !== 'CallExpression') {
                return false;
            }

            const callee = node.callee;

            // Check if the method being called is 'includes'
            if (!(callee.type === 'MemberExpression'
                && callee.property.type === 'Identifier'
                && callee.property.name === 'includes')) {
                return false;
            }

            // The object should be an Identifier named 'betas' (or similar, based on common patterns)
            // This can be extended to `props.betas` if needed, but for the example, `betas` is direct.
            if (!(callee.object.type === 'Identifier' && callee.object.name === 'betas')) {
                return false;
            }

            // Check the argument: it should be `CONST.BETAS.SOME_BETA`
            if (node.arguments.length === 1) {
                return true;
            }
            return false;
        }

        /**
         * Recursively checks if an expression contains the `betas?.includes(...)` pattern.
         * This handles `!!betas?.includes(...)`, `betas?.includes(...) || otherCheck(...)`, etc.
         * @param {ASTNode} node The AST node (expression) to check.
         * @returns {boolean} True if the expression contains the beta check, false otherwise.
         */
        function containsBetaCheck(node) {
            if (!node) {
                return false;
            }

            // Handle `!!betas?.includes(...)`
            if (node.type === 'UnaryExpression') {
                return containsBetaCheck(node.argument);
            }

            if (node.type === 'ChainExpression') {
                return containsBetaCheck(node.expression);
            }

            // Direct `betas?.includes(...)` call
            if (isBetaIncludesCall(node)) {
                return true;
            }

            // Handle `betas?.includes(...) || canUseAllBetas(...)` or `betas?.includes(...) && otherCheck(...)`
            if (node.type === 'LogicalExpression') {
                return containsBetaCheck(node.left) || containsBetaCheck(node.right);
            }

            // Handle conditional expressions (ternary operator)
            if (node.type === 'ConditionalExpression') {
                return containsBetaCheck(node.test) || containsBetaCheck(node.consequent) || containsBetaCheck(node.alternate);
            }

            return false;
        }

        /**
         * Reports the function if it contains a custom beta check.
         * @param {ASTNode} node The function declaration or variable declarator node.
         * @param {string} functionName The name of the function to report.
         */
        function reportFunction(node, functionName) {
            context.report({
                node,
                messageId: 'useIsBetaEnabled',
                data: {functionName: functionName || 'anonymous function'},
            });
        }

        return {
            // Visit FunctionDeclaration nodes (e.g., `function canUseAutoSubmit(...) { ... }`)
            FunctionDeclaration(node) {
                // Check if the function body is a block statement
                if ((node.id && node.id.name === 'isBetaEnabled') || !node.body || node.body.type !== 'BlockStatement') {
                    return;
                }
                for (const statement of node.body.body) {
                    // Look for return statements within the function body
                    if (statement.type === 'ReturnStatement') {
                        if (containsBetaCheck(statement.argument)) {
                            reportFunction(node, node.id ? node.id.name : '');
                            break; // Report once per function
                        }
                    }
                }
            },

            // Visit VariableDeclarator nodes (e.g., `const canUseAutoSubmit = (betas) => { ... };`)
            VariableDeclarator(node) {
                // Ensure it's an arrow function or function expression
                if ((node.id && node.id.name === 'isBetaEnabled') || !node.init || !(node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')) {
                    return;
                }
                const funcBody = node.init.body;

                // Handle block body (e.g., `() => { return ... }`)
                if (funcBody.type === 'BlockStatement') {
                    for (const statement of funcBody.body) {
                        if (statement.type === 'ReturnStatement') {
                            if (containsBetaCheck(statement.argument)) {
                                reportFunction(node, node.id ? node.id.name : '');
                                break;
                            }
                        }
                    }
                } else {
                    // Handle implicit return for arrow functions (e.g., `() => !!betas?.includes(...)`)
                    if (!containsBetaCheck(funcBody)) {
                        return;
                    }
                    reportFunction(node, node.id ? node.id.name : '');
                }
            },
        };
    },
};
