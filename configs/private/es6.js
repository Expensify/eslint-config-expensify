import {defineConfig} from 'eslint/config';

const config = defineConfig([
    {
        rules: {
            // enforces no braces where they can be omitted
            // https://eslint.org/docs/rules/arrow-body-style
            // TODO: enable requireReturnForObjectLiteral?
            'arrow-body-style': ['error', 'as-needed', {
                requireReturnForObjectLiteral: false,
            }],

            // verify super() callings in constructors
            'constructor-super': 'error',

            // disallow modifying variables of class declarations
            // https://eslint.org/docs/rules/no-class-assign
            'no-class-assign': 'error',

            // disallow arrow functions where they could be confused with comparisons
            // https://eslint.org/docs/rules/no-confusing-arrow
            'no-confusing-arrow': ['error', {
                allowParens: true,
            }],

            // disallow modifying variables that are declared using const
            'no-const-assign': 'error',

            // disallow duplicate class members
            // https://eslint.org/docs/rules/no-dupe-class-members
            'no-dupe-class-members': 'error',

            // disallow importing from the same path more than once
            // replaced by https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-duplicates.md
            'no-duplicate-imports': 'off',

            // disallow symbol constructor
            // https://eslint.org/docs/rules/no-new-symbol
            'no-new-symbol': 'error',

            // Disallow specified names in exports
            // https://eslint.org/docs/rules/no-restricted-exports
            'no-restricted-exports': ['error', {
                restrictedNamedExports: [
                    'default', // use `export default` to provide a default export
                    'then', // this will cause tons of confusion when your module is dynamically `import()`ed, and will break in most node ESM versions
                ],
            }],

            // disallow specific imports
            // https://eslint.org/docs/rules/no-restricted-imports
            'no-restricted-imports': ['off', {
                paths: [],
                patterns: [],
            }],

            // disallow to use this/super before super() calling in constructors.
            // https://eslint.org/docs/rules/no-this-before-super
            'no-this-before-super': 'error',

            // disallow useless computed property keys
            // https://eslint.org/docs/rules/no-useless-computed-key
            'no-useless-computed-key': 'error',

            // disallow unnecessary constructor
            // https://eslint.org/docs/rules/no-useless-constructor
            'no-useless-constructor': 'error',

            // disallow renaming import, export, and destructured assignments to the same name
            // https://eslint.org/docs/rules/no-useless-rename
            'no-useless-rename': ['error', {
                ignoreDestructuring: false,
                ignoreImport: false,
                ignoreExport: false,
            }],

            // require let or const instead of var
            'no-var': 'error',

            // require method and property shorthand syntax for object literals
            // https://eslint.org/docs/rules/object-shorthand
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

            // Prefer destructuring from arrays and objects — off per Expensify style guide
            // https://github.com/Expensify/Style-Guide/pull/60
            'prefer-destructuring': 'off',

            // disallow parseInt() in favor of binary, octal, and hexadecimal literals
            // https://eslint.org/docs/rules/prefer-numeric-literals
            'prefer-numeric-literals': 'error',

            'prefer-reflect': 'off',

            // use rest parameters instead of arguments
            // https://eslint.org/docs/rules/prefer-rest-params
            'prefer-rest-params': 'error',

            // suggest using the spread syntax instead of .apply()
            // https://eslint.org/docs/rules/prefer-spread
            'prefer-spread': 'error',

            // suggest using template literals instead of string concatenation
            'prefer-template': 'error',

            // disallow generator functions that do not have yield
            // https://eslint.org/docs/rules/require-yield
            'require-yield': 'error',

            // enforce spacing between object rest-spread
            // https://eslint.org/docs/rules/rest-spread-spacing
            'rest-spread-spacing': ['error', 'never'],

            // import sorting
            'sort-imports': ['off', {
                ignoreCase: false,
                ignoreDeclarationSort: false,
                ignoreMemberSort: false,
                memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
            }],

            // require a Symbol description
            // https://eslint.org/docs/rules/symbol-description
            'symbol-description': 'error',

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
        },
    },
    {
        // Do not use these features yet in JavaScript; TypeScript may use them
        files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
        rules: {
            'es/no-nullish-coalescing-operators': 'error',
            'es/no-optional-chaining': 'error',
        },
    },
]);

export default config;
