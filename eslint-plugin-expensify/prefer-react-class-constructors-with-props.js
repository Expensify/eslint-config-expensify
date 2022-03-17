const message = require('./CONST').MESSAGE.PREFER_REACT_CLASS_CONSTRUCTORS_WITH_PROPS;

module.exports = {
    create: context => ({
        ClassDeclaration(node) {
            // If there's no super class inheritance don't proceed
            if (!node.superClass) {
                return;
            }

            const whiteList = ['React', 'Component'];

            // Check if the super class name is 'Component' eg. Car extends Component {}
            if (node.superClass.name) {
                if (node.superClass.name !== 'Component') {
                    return;
                }
            } else {
                // If there's no super class object called react don't proceed eg. Car extends React.[AnyProperty] {} ||  Car extends Component {}
                if (node.superClass.object) {
                    if (!whiteList.includes(node.superClass.object.name)) {
                        return;
                    }
                } else {
                    return;
                }

                // Check if the super class property name is 'Component' eg. Car extends React.Component {}
                if (node.superClass.property) {
                    if (node.superClass.property.name !== 'Component') {
                        return;
                    }
                }
            }

            // Gets all the method definitions in the class
            const methods = node.body.body;

            // Gets the constructor method definition if any
            const constructorMethodDefinition = methods.find(method => method.kind === 'constructor');

            if (!constructorMethodDefinition) {
                context.report({
                    node,
                    message,
                });
                return;
            }

            const {
                parent,
                params,
                body,
            } = constructorMethodDefinition.value;

            // Anonymous function to check if there's a props parameter
            const hasPropsParameter = ({
                                           name,
                                           type,
                                       }) => name === 'props' && type === 'Identifier';

            // Anonymous function to check if there's a super call
            const hasSuperCall = ({
                                      type,
                                      expression,
                                  }) => type === 'ExpressionStatement'
                && expression.type === 'CallExpression'
                && expression.callee.type === 'Super'
                && expression.arguments.some(hasPropsParameter);

            if (parent.kind === 'constructor') {
                // Check if the constructor has a parameter called 'props', return if not
                if (!params.some(hasPropsParameter)) {
                    context.report({
                        node,
                        message,
                    });
                    return;
                }

                // Check if the constructor has a super call with any parameter called 'props'
                if (!body.body.some(hasSuperCall)) {
                    context.report({
                        node,
                        message,
                    });
                }
            }

        },
    }),
};
