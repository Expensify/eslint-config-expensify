module.exports = {
    rules: {
        'prefer-template': 'error',

        // Rather then blindly enforcing destructuring assignments, we'll trust the author's best judgement on when
        // to make use of them, and when not; see https://github.com/Expensify/Style-Guide/pull/60 for more details
        'prefer-destructuring': 'off',

        // By default, this rules makes us use both "for" attributes and nest inputs inside of
        // labels. We would rather just do either since browsers don't have a preference.
        'jsx-a11y/label-has-associated-control': ['error', {
            assert: 'either',
        }],

        // Only require parens around arrow function arguments when there is a block body
        'arrow-parens': ['error', 'as-needed', {
            requireForBlockBody: true,
        }],

        // Do not allow the use of async/await
        '@lwc/lwc/no-async-await': 'error',

        // Do not use these features yet
        'es/no-nullish-coalescing-operators': 'error',
        'es/no-optional-chaining': 'error',

        // Use of `this` outside class methods can lead to crashes on minified code
        'no-invalid-this': 'error',

        // Override no-restricted-syntax to allow for...of loops
        'no-restricted-syntax': ['error',
            {
                selector: 'ForInStatement',
                message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. '
                    + 'Use Object.{keys,values,entries}, and iterate over the resulting array.',
            },
            {
                selector: 'LabeledStatement',
                message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
            },
            {
                selector: 'WithStatement',
                message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize. It is also deprecated.',
            },
        ],

        // =============================================
        // ES6 RULES (from eslint-config-airbnb)
        // =============================================

        // require space before/after arrow function's arrow
        'arrow-spacing': ['error', {before: true, after: true}],

        // verify super() callings in constructors
        'constructor-super': 'error',

        // enforce the spacing around the * in generator functions
        'generator-star-spacing': ['error', {before: false, after: true}],

        // disallow modifying variables of class declarations
        'no-class-assign': 'error',

        // disallow arrow functions where they could be confused with comparisons
        'no-confusing-arrow': ['error', {
            allowParens: true,
        }],

        // disallow modifying variables that are declared using const
        'no-const-assign': 'error',

        // disallow duplicate class members
        'no-dupe-class-members': 'error',

        // disallow importing from the same path more than once
        'no-duplicate-imports': 'off', // replaced by https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-duplicates.md

        // disallow symbol constructor
        'no-new-symbol': 'error',

        // Disallow specified names in exports
        'no-restricted-exports': ['off', {
            restrictedNames: ['default', 'then'],
        }],

        // disallow to use this/super before super() calling in constructors.
        'no-this-before-super': 'error',

        // disallow useless computed property keys
        'no-useless-computed-key': 'error',

        // disallow unnecessary constructor
        'no-useless-constructor': 'error',

        // disallow renaming import, export, and destructured assignments to the same name
        'no-useless-rename': ['error', {
            ignoreDestructuring: false,
            ignoreImport: false,
            ignoreExport: false,
        }],

        // require let or const instead of var
        'no-var': 'error',

        // require method and property shorthand syntax for object literals
        'object-shorthand': ['error', 'always', {
            ignoreConstructors: false,
            avoidQuotes: true,
        }],

        // suggest using arrow functions as callbacks
        'prefer-arrow-callback': ['error', {
            allowNamedFunctions: false,
            allowUnboundThis: true,
        }],

        // suggest using of const declaration for variables that are never modified after declared
        'prefer-const': ['error', {
            destructuring: 'any',
            ignoreReadBeforeAssign: true,
        }],

        // disallow parseInt() in favor of binary, octal, and hexadecimal literals
        'prefer-numeric-literals': 'error',

        // suggest using Reflect methods where applicable
        'prefer-reflect': 'off',

        // use rest parameters instead of arguments
        'prefer-rest-params': 'error',

        // suggest using the spread operator instead of .apply()
        'prefer-spread': 'error',

        // disallow generator functions that do not have yield
        'require-yield': 'error',

        // enforce spacing between object rest-spread
        'rest-spread-spacing': ['error', 'never'],

        // require a Symbol description
        'symbol-description': 'error',

        // enforce usage of spacing in template strings
        'template-curly-spacing': 'error',

        // enforce spacing around the * in yield* expressions
        'yield-star-spacing': ['error', 'after'],
    },
};
