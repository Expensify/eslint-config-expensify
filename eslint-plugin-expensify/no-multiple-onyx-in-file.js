const lodashGet = require('lodash/get');
const message = require('./CONST').MESSAGE.NO_MULTIPLE_ONYX_IN_FILE;

module.exports = {
    create: (context) => {
        let withOnyxCount = 0;

        return {
            CallExpression(node) {
                const calleeName = lodashGet(node, 'callee.name');

                if (calleeName === 'withOnyx') {
                    withOnyxCount += 1;

                    if (withOnyxCount > 1) {
                        context.report({
                            node,
                            message,
                        });
                    }
                }
            },
            'Program:exit': () => {
                withOnyxCount = 0;
            },
        };
    },
};
