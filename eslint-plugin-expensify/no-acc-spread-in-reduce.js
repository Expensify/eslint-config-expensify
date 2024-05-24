const _ = require('lodash');
const CONST = require('./CONST');

// Matches function expression as a direct descendant (argument callback) of "reduce" or "reduceRight" call
const MATCH = 'CallExpression:matches([callee.property.name="reduce"], [callee.property.name="reduceRight"]) > :matches(ArrowFunctionExpression, FunctionExpression)';

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: CONST.MESSAGE.NO_ACC_SPREAD_IN_REDUCE,
            category: 'Best Practices',
            recommended: false,
        },
        schema: [], // no options
    },
    create(context) {
        return {
            [MATCH](node) {
                // Retrieve accumulator variable
                const accumulator = context.getDeclaredVariables(node)[0];
                if (!accumulator) {
                    return;
                }

                // Check if accumulatorVariable has any references (is used in the scope)
                if (!accumulator.references.length) {
                    return;
                }

                // Check if any of the references are used in a SpreadElement
                const isAccumulatorVariableUsedSpread = _.some(
                    accumulator.references,
                    reference => reference.identifier.parent.type === 'SpreadElement',
                );
                if (!isAccumulatorVariableUsedSpread) {
                    return;
                }

                // Accumulator variable is used in a SpreadElement, report it
                context.report({
                    node,
                    message: CONST.MESSAGE.NO_ACC_SPREAD_IN_REDUCE,
                });
            },
        };
    },
};
