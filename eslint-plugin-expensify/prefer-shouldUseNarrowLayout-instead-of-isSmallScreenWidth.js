const _ = require("underscore");
const CONST = require("./CONST");

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Warn against using isSmallScreenWidth from useResponsiveLayout and suggest using shouldUseNarrowLayout instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (
          !node.init ||
          !node.init.callee ||
          node.init.callee.name !== "useResponsiveLayout"
        ) {
          return;
        }

        // Check for 'const {isSmallScreenWidth, ...} = useResponsiveLayout();' pattern
        if (node.id.type === "ObjectPattern") {
          node.id.properties.forEach((property) => {
            if (!property.key || property.key.name !== "isSmallScreenWidth") {
              return;
            }
            context.report({
              node: property,
              message:
                CONST.MESSAGE
                  .PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH,
            });
          });
        }

        // Check for 'const var = useResponsiveLayout();' and use of this var
        const variableName = node.id.name;
        const variableUsages = _.filter(
          context.getScope().references,
          (reference) => reference.identifier.name === variableName
        );
        variableUsages.forEach((usage) => {
          const parent = usage.identifier.parent;

          // Check for 'const isSmallScreen = var.isSmallScreenWidth;' pattern
          if (
            parent.type === "MemberExpression" &&
            parent.property.name === "isSmallScreenWidth"
          ) {
            context.report({
              node: parent.property,
              message:
                CONST.MESSAGE
                  .PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH,
            });
          }

          // Check for 'const {isSmallScreenWidth} = var;' pattern
          if (
            parent.type === "VariableDeclarator" &&
            parent.id.type === "ObjectPattern"
          ) {
            parent.id.properties.forEach((property) => {
              if (!property.key || property.key.name !== "isSmallScreenWidth") {
                return;
              }
              context.report({
                node: property,
                message:
                  CONST.MESSAGE
                    .PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH,
              });
            });
          }
        });
      },
      MemberExpression(node) {
        // Check for 'const isSmallScreenWidth = useResponsiveLayout().isSmallScreenWidth;' pattern
        if (
          node.object.type !== "CallExpression" ||
          node.object.callee.name !== "useResponsiveLayout" ||
          node.property.name !== "isSmallScreenWidth"
        ) {
          return;
        }
        context.report({
          node,
          message:
            CONST.MESSAGE
              .PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH,
        });
      },
    };
  },
};
