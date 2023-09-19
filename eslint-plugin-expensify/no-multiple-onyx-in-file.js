const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.NO_MULTIPLE_ONYX_IN_FILE;

module.exports = {
    create: (context) => {
        let withOnyxDetails = [];

        return {
            CallExpression(node) {
                const calleeName = lodashGet(node, 'callee.name');

                if (calleeName === 'withOnyx') {
                    const details = context.getSourceCode().getText(node.arguments[0]);

                    if (withOnyxDetails.includes(details)) {
                        context.report({
                            node,
                            message,
                        });
                    } else {
                        withOnyxDetails.push(details);
                    }
                }
            },
            'Program:exit': () => {
                withOnyxDetails = [];
            },
        };
    },
};
