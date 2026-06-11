import {defineConfig} from 'eslint/config';

/**
 * Pure formatting rules enforced by ESLint.
 *
 * Opt in via eslint-config-expensify/formatting when a repo is not using
 * Prettier or another dedicated formatter.
 */
const config = defineConfig([{
    rules: {
        'array-bracket-spacing': ['error', 'never'],
        'block-spacing': ['error', 'always'],
        'brace-style': ['error', '1tbs', {allowSingleLine: true}],
        'comma-dangle': ['error', 'always-multiline'],
        'comma-spacing': ['error', {before: false, after: true}],
        'comma-style': ['error', 'last', {
            exceptions: {
                ArrayExpression: false,
                ArrayPattern: false,
                ArrowFunctionExpression: false,
                CallExpression: false,
                FunctionDeclaration: false,
                FunctionExpression: false,
                ImportDeclaration: false,
                ObjectExpression: false,
                ObjectPattern: false,
                VariableDeclaration: false,
                NewExpression: false,
            },
        }],
        'computed-property-spacing': ['error', 'never'],
        'eol-last': ['error', 'always'],
        'func-call-spacing': ['error', 'never'],
        'function-call-argument-newline': ['error', 'consistent'],
        'function-paren-newline': ['error', 'multiline-arguments'],
        'implicit-arrow-linebreak': ['error', 'beside'],

        // Enforce indentation of 4 spaces; the third option parameter was copied from Airbnb:
        // https://github.com/airbnb/javascript/blob/60b96d322277c4c71a21a05caba8eb3320e0e3fa/packages/eslint-config-airbnb-base/rules/style.js#L120-L145
        indent: ['error', 4, {
            SwitchCase: 1,
            VariableDeclarator: 1,
            outerIIFEBody: 1,
            FunctionDeclaration: {
                parameters: 1,
                body: 1,
            },
            FunctionExpression: {
                parameters: 1,
                body: 1,
            },
            CallExpression: {
                arguments: 1,
            },
            ArrayExpression: 1,
            ObjectExpression: 1,
            ImportDeclaration: 1,
            flatTernaryExpressions: false,

            // list derived from https://github.com/benjamn/ast-types/blob/HEAD/def/jsx.js
            // eslint-disable-next-line max-len
            ignoredNodes: ['JSXElement', 'JSXElement > *', 'JSXAttribute', 'JSXIdentifier', 'JSXNamespacedName', 'JSXMemberExpression', 'JSXSpreadAttribute', 'JSXExpressionContainer', 'JSXOpeningElement', 'JSXClosingElement', 'JSXText', 'JSXEmptyExpression', 'JSXSpreadChild'],
            ignoreComments: false,
        }],
        'key-spacing': ['error', {beforeColon: false, afterColon: true}],
        'keyword-spacing': ['error', {
            before: true,
            after: true,
            overrides: {
                return: {after: true},
                throw: {after: true},
                case: {after: true},
            },
        }],
        'linebreak-style': ['error', 'unix'],

        // Airbnb didn't want this rule to be enabled even though it complies with their styleguide - so we're adding it
        // https://github.com/airbnb/javascript/pull/1994
        'lines-around-comment': ['error', {
            beforeLineComment: true,
            allowBlockStart: true,
            allowObjectStart: true,
            allowArrayStart: true,
            allowClassStart: true,
        }],
        'lines-between-class-members': ['error', 'always', {exceptAfterSingleLine: false}],
        'lines-around-directive': ['error', {
            before: 'always',
            after: 'always',
        }],
        'max-len': ['error', {
            code: 190,
        }],
        'newline-per-chained-call': ['error', {ignoreChainWithDepth: 4}],
        'no-mixed-spaces-and-tabs': 'error',
        'no-multi-spaces': ['error', {
            ignoreEOLComments: false,
        }],
        'no-multiple-empty-lines': ['error', {max: 1}],
        'no-spaced-func': 'error',
        'no-tabs': 'error',
        'no-trailing-spaces': ['error', {
            skipBlankLines: false,
            ignoreComments: false,
        }],
        'no-whitespace-before-property': 'error',
        'nonblock-statement-body-position': ['error', 'beside', {overrides: {}}],
        'object-curly-spacing': ['error', 'never'],
        'object-curly-newline': ['error', {
            ObjectExpression: {minProperties: 4, multiline: true, consistent: true},
            ObjectPattern: {minProperties: 4, multiline: true, consistent: true},
            ImportDeclaration: {minProperties: 4, multiline: true, consistent: true},
            ExportDeclaration: {minProperties: 4, multiline: true, consistent: true},
        }],
        'object-property-newline': ['error', {
            allowAllPropertiesOnSameLine: true,
        }],
        'operator-linebreak': ['error', 'before', {overrides: {'=': 'none'}}],
        'padded-blocks': ['error', {
            blocks: 'never',
            classes: 'never',
            switches: 'never',
        }, {
            allowSingleLineBlocks: true,
        }],
        'quote-props': ['error', 'as-needed', {keywords: false, unnecessary: true, numbers: false}],
        quotes: ['error', 'single', {avoidEscape: true}],
        semi: ['error', 'always'],
        'semi-spacing': ['error', {before: false, after: true}],
        'semi-style': ['error', 'last'],
        'space-before-blocks': 'error',
        'space-before-function-paren': ['error', {
            anonymous: 'always',
            named: 'never',
        }],
        'space-in-parens': ['error', 'never'],
        'space-infix-ops': 'error',
        'space-unary-ops': ['error', {
            words: true,
            nonwords: false,
            overrides: {},
        }],
        'spaced-comment': ['error', 'always', {
            line: {
                exceptions: ['-', '+'],
                markers: ['=', '!', '/'],
            },
            block: {
                exceptions: ['-', '+'],
                markers: ['=', '!', ':', '::'],
                balanced: true,
            },
        }],
        'switch-colon-spacing': ['error', {after: true, before: false}],
        'template-tag-spacing': ['error', 'never'],
        'unicode-bom': ['error', 'never'],
        'wrap-iife': ['error', 'inside'],

        // ES6 formatting
        'arrow-parens': ['error', 'as-needed', {
            requireForBlockBody: true,
        }],
        'arrow-spacing': ['error', {before: true, after: true}],
        'generator-star-spacing': ['error', {before: false, after: true}],
        'template-curly-spacing': 'error',
        'yield-star-spacing': ['error', 'after'],
    },
}]);

export default config;
