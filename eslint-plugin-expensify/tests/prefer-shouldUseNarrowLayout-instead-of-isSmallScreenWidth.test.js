const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth');
const message = require('../CONST').MESSAGE
    .PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run(
    'prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth',
    rule,
    {
        valid: [
            {
                code: 'const {shouldUseNarrowLayout} = useResponsiveLayout();',
            },
        ],
        invalid: [
            {
                code: 'const {isSmallScreenWidth} = useResponsiveLayout();',
                errors: [
                    {
                        message,
                    },
                ],
            },
            {
                code: 'const {isSmallScreenWidth, shouldUseNarrowLayout} = useResponsiveLayout();',
                errors: [
                    {
                        message,
                    },
                ],
            },
            {
                code: `
            const isSmallScreenWidth = useResponsiveLayout().isSmallScreenWidth;
            `,
                errors: [
                    {
                        message,
                    },
                ],
            },
            {
                code: `
            const dimensions = useResponsiveLayout();
            const isSmallScreenWidth = dimensions.isSmallScreenWidth;
            `,
                errors: [
                    {
                        message,
                    },
                ],
            },
            {
                code: `
            const dimensions = useResponsiveLayout();
            const {isSmallScreenWidth} = dimensions;
            `,
                errors: [
                    {
                        message,
                    },
                ],
            },
        ],
    },
);
