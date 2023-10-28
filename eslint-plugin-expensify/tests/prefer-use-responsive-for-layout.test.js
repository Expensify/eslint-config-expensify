const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-use-responsive-for-layout');
const message = require('../CONST').MESSAGE.PREFER_USE_RESPONSIVE_FOR_LAYOUT;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('prefer-use-responsive-for-layout', rule, {
    valid: [
        {
            code: 'const { shouldUseNarrowLayout } = useResponsiveLayout();',
        },
        {
            code: `
            const dimensions = useWindowDimensions();
            const { windowWidth } = dimensions;
            `,
        },
    ],
    invalid: [
        {
            code: 'const { isSmallScreenWidth } = useWindowDimensions();',
            errors: [
                {
                    message,
                },
            ],
        },
        {
            code: `
            const isSmallScreen = useWindowDimensions().isSmallScreenWidth;
            `,
            errors: [
                {
                    message,
                },
            ],
        },
        {
            code: `
            const dimensions = useWindowDimensions();
            const isSmallScreen = dimensions.isSmallScreenWidth;
            `,
            errors: [
                {
                    message,
                },
            ],
        },
        {
            code: `
            const dimensions = useWindowDimensions();
            const {isSmallScreenWidth} = dimensions;
            `,
            errors: [
                {
                    message,
                },
            ],
        },
    ],
});
