import {defineConfig} from 'eslint/config';

const config = defineConfig([{
    rules: {
        // enforce line breaks after opening and before closing array brackets
        // https://eslint.org/docs/rules/array-bracket-newline
        // TODO: enable? semver-major
        'array-bracket-newline': ['off', 'consistent'], // object option alternative: { multiline: true, minItems: 3 }

        // enforce line breaks between array elements
        // https://eslint.org/docs/rules/array-element-newline
        // TODO: enable? semver-major
        'array-element-newline': ['off', {multiline: true, minItems: 3}],

        // require camel case names
        camelcase: ['error', {properties: 'never', ignoreDestructuring: false}],

        // enforce or disallow capitalization of the first letter of a comment
        // https://eslint.org/docs/rules/capitalized-comments
        'capitalized-comments': ['off', 'never', {
            line: {
                ignorePattern: '.*',
                ignoreInlineComments: true,
                ignoreConsecutiveComments: true,
            },
            block: {
                ignorePattern: '.*',
                ignoreInlineComments: true,
                ignoreConsecutiveComments: true,
            },
        }],

        // enforces consistent naming when capturing the current execution context
        'consistent-this': 'off',

        // requires function names to match the name of the variable or property to which they are
        // assigned
        // https://eslint.org/docs/rules/func-name-matching
        'func-name-matching': ['off', 'always', {
            includeCommonJSModuleExports: false,
            considerPropertyDescriptor: true,
        }],

        // require function expressions to have a name
        // https://eslint.org/docs/rules/func-names
        'func-names': 'error',

        // enforces use of function declarations or expressions
        // https://eslint.org/docs/rules/func-style
        // TODO: enable
        'func-style': ['off', 'expression'],

        // disallow specified identifiers
        // https://eslint.org/docs/rules/id-denylist
        'id-denylist': 'off',

        // this option enforces minimum and maximum identifier lengths
        // (variable names, property names etc.)
        'id-length': 'off',

        // require identifiers to match the provided regular expression
        'id-match': 'off',

        // enforce position of line comments
        // https://eslint.org/docs/rules/line-comment-position
        // TODO: enable?
        'line-comment-position': ['off', {
            position: 'above',
            ignorePattern: '',
            applyDefaultPatterns: true,
        }],

        // specify the maximum depth that blocks can be nested
        'max-depth': ['off', 4],

        // specify the max number of lines in a file
        // https://eslint.org/docs/rules/max-lines
        'max-lines': ['off', {
            max: 300,
            skipBlankLines: true,
            skipComments: true,
        }],

        // enforce a maximum function length
        // https://eslint.org/docs/rules/max-lines-per-function
        'max-lines-per-function': ['off', {
            max: 50,
            skipBlankLines: true,
            skipComments: true,
            IIFEs: true,
        }],

        // specify the maximum depth callbacks can be nested
        'max-nested-callbacks': 'off',

        // limits the number of parameters that can be used in the function declaration.
        'max-params': ['off', 3],

        // specify the maximum number of statement allowed in a function
        'max-statements': ['off', 10],

        // restrict the number of statements per line
        // https://eslint.org/docs/rules/max-statements-per-line
        'max-statements-per-line': ['off', {max: 1}],

        // enforce a particular style for multiline comments
        // https://eslint.org/docs/rules/multiline-comment-style
        'multiline-comment-style': ['off', 'starred-block'],

        // require multiline ternary
        // https://eslint.org/docs/rules/multiline-ternary
        // TODO: enable?
        'multiline-ternary': ['off', 'never'],

        // require a capital letter for constructors
        'new-cap': ['error', {
            newIsCap: true,
            newIsCapExceptions: [],
            capIsNew: false,
            capIsNewExceptions: ['Immutable.Map', 'Immutable.Set', 'Immutable.List'],
        }],

        // disallow the omission of parentheses when invoking a constructor with no arguments
        // https://eslint.org/docs/rules/new-parens
        'new-parens': 'error',

        // allow/disallow an empty newline after var statement
        'newline-after-var': 'off',

        // https://eslint.org/docs/rules/newline-before-return
        'newline-before-return': 'off',

        // disallow use of the Array constructor
        'no-array-constructor': 'error',

        // disallow use of bitwise operators
        // https://eslint.org/docs/rules/no-bitwise
        'no-bitwise': 'error',

        // disallow comments inline after code
        'no-inline-comments': 'off',

        // disallow if as the only statement in an else block
        // https://eslint.org/docs/rules/no-lonely-if
        'no-lonely-if': 'error',

        // disallow un-paren'd mixes of different operators
        // https://eslint.org/docs/rules/no-mixed-operators
        'no-mixed-operators': ['error', {
            // the list of arithmetic groups disallows mixing `%` and `**`
            // with other arithmetic operators.
            groups: [
                ['%', '**'],
                ['%', '+'],
                ['%', '-'],
                ['%', '*'],
                ['%', '/'],
                ['/', '*'],
                ['&', '|', '<<', '>>', '>>>'],
                ['==', '!=', '===', '!=='],
                ['&&', '||'],
            ],
            allowSamePrecedence: false,
        }],

        // disallow use of chained assignment expressions
        // https://eslint.org/docs/rules/no-multi-assign
        'no-multi-assign': ['error'],

        // disallow negated conditions
        // https://eslint.org/docs/rules/no-negated-condition
        'no-negated-condition': 'off',

        // disallow nested ternary expressions
        'no-nested-ternary': 'error',

        // disallow use of the Object constructor
        'no-new-object': 'error',

        // disallow use of unary operators, ++ and --
        // https://eslint.org/docs/rules/no-plusplus
        'no-plusplus': 'error',

        // disallow certain syntax forms
        // https://eslint.org/docs/rules/no-restricted-syntax
        'no-restricted-syntax': [
            'error',
            {
                selector: 'ForInStatement',
                message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. '
                    + 'Use Object.{keys,values,entries}, and iterate over the resulting array.',
            },
            {
                selector: 'ForOfStatement',
                message: 'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. '
                    + 'Separately, loops should be avoided in favor of array iterations.',
            },
            {
                selector: 'LabeledStatement',
                message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
            },
            {
                selector: 'WithStatement',
                message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
            },
        ],

        // disallow the use of ternary operators
        'no-ternary': 'off',

        // disallow dangling underscores in identifiers
        // https://eslint.org/docs/rules/no-underscore-dangle
        'no-underscore-dangle': ['error', {
            allow: [],
            allowAfterThis: false,
            allowAfterSuper: false,
            enforceInMethodNames: true,
        }],

        // disallow the use of Boolean literals in conditional expressions
        // also, prefer `a || b` over `a ? a : b`
        // https://eslint.org/docs/rules/no-unneeded-ternary
        'no-unneeded-ternary': ['error', {defaultAssignment: false}],

        // allow just one var statement per function
        'one-var': ['error', 'never'],

        // require a newline around variable declaration
        // https://eslint.org/docs/rules/one-var-declaration-per-line
        'one-var-declaration-per-line': ['error', 'always'],

        // require assignment operator shorthand where possible or prohibit it entirely
        // https://eslint.org/docs/rules/operator-assignment
        'operator-assignment': ['error', 'always'],

        // Require or disallow padding lines between statements
        // https://eslint.org/docs/rules/padding-line-between-statements
        'padding-line-between-statements': 'off',

        // Disallow the use of Math.pow in favor of the ** operator
        // https://eslint.org/docs/rules/prefer-exponentiation-operator
        'prefer-exponentiation-operator': 'error',

        // Prefer use of an object spread over Object.assign
        // https://eslint.org/docs/rules/prefer-object-spread
        'prefer-object-spread': 'error',

        // do not require jsdoc
        // https://eslint.org/docs/rules/require-jsdoc
        'require-jsdoc': 'off',

        // requires object keys to be sorted
        'sort-keys': ['off', 'asc', {caseSensitive: false, natural: true}],

        // sort variables within the same declaration block
        'sort-vars': 'off',

        // require regex literals to be wrapped in parentheses
        'wrap-regex': 'off',
    },
}]);

export default config;
