module.exports = {
    rules: {
        // Do not prevent multiple component definition per file
        'react/no-multi-comp': 'off',

        // Do not prevent missing React when using JSX
        'react/react-in-jsx-scope': 'off',

        // Enforce indentation of 4 spaces
        'react/jsx-indent-props': ['error', 4],
        'react/jsx-indent': ['error', 4],
        'react/jsx-no-undef': ['error', {
            allowGlobals: true,
        }],
        'react/prefer-es6-class': 'error',
        'react/prefer-stateless-function': 'error',
        'react/prop-types': 'error',
        'react/jsx-props-no-multi-spaces': 'off',
        'react/no-find-dom-node': 'error',
        'react/forbid-prop-types': 'error',
        'react/no-string-refs': 'error',
        'react/jsx-filename-extension': [1, {extensions: ['.js']}],
        'react/destructuring-assignment': 'off',
        'react/function-component-definition': [
            'error',
            {
                namedComponents: 'function-declaration',
                unnamedComponents: 'arrow-function',
            },
        ],

        // New versions of react are removing some methods, and those methods have been prefixed with "UNSAFE_" for now.
        // We need to prevent more usages of these methods and their aliases from being added
        'react/no-unsafe': ['error', {
            checkAliases: true,
        }],

        // =============================================
        // REACT RULES (from eslint-config-airbnb)
        // =============================================

        // Prevent missing displayName in a React component definition
        'react/display-name': ['error', {ignoreTranspilerName: false}],

        // Forbid certain props on DOM Nodes
        'react/forbid-dom-props': ['off', {forbid: []}],

        // Enforce boolean attributes notation in JSX
        'react/jsx-boolean-value': ['error', 'never', {always: []}],

        // Validate closing bracket location in JSX
        'react/jsx-closing-bracket-location': ['error', 'line-aligned'],

        // Validate closing tag location in JSX
        'react/jsx-closing-tag-location': 'error',

        // Enforce or disallow spaces inside of curly braces in JSX attributes
        'react/jsx-curly-spacing': ['error', 'never', {allowMultiline: true}],

        // Enforce event handler naming conventions in JSX
        'react/jsx-handler-names': ['off', {
            eventHandlerPrefix: 'handle',
            eventHandlerPropPrefix: 'on',
            checkLocalVariables: false,
            checkInlineFunction: true,
        }],

        // Validate JSX has key prop when in array or iterator
        'react/jsx-key': 'error',

        // Limit maximum of props on a single line in JSX
        'react/jsx-max-props-per-line': ['error', {maximum: 1, when: 'multiline'}],

        // Prevent usage of .bind() in JSX props
        'react/jsx-no-bind': ['error', {
            ignoreRefs: true,
            allowArrowFunctions: true,
            allowFunctions: false,
            allowBind: false,
            ignoreDOMComponents: true,
        }],

        // Prevent comments from being inserted as text nodes
        'react/jsx-no-comment-textnodes': 'error',

        // Prevent duplicate props in JSX
        'react/jsx-no-duplicate-props': ['error', {ignoreCase: true}],

        // Prevent usage of unwrapped JSX strings
        'react/jsx-no-literals': ['off', {noStrings: true}],

        // Enforce PascalCase for user-defined JSX components
        'react/jsx-pascal-case': ['error', {
            allowAllCaps: true,
            ignore: [],
        }],

        // Enforce propTypes declarations alphabetical sorting
        'react/jsx-sort-prop-types': 'off',

        // Enforce props alphabetical sorting
        'react/jsx-sort-props': ['off', {
            ignoreCase: true,
            callbacksLast: false,
            shorthandFirst: false,
            shorthandLast: false,
            noSortAlphabetically: false,
            reservedFirst: true,
        }],

        // Prevent React to be incorrectly marked as unused
        'react/jsx-uses-react': ['error'],

        // Prevent variables used in JSX to be incorrectly marked as unused
        'react/jsx-uses-vars': 'error',

        // Prevent usage of dangerous JSX properties
        'react/no-danger': 'warn',

        // Prevent usage of deprecated methods
        'react/no-deprecated': ['error'],

        // Prevent usage of setState in componentDidMount
        'react/no-did-mount-set-state': 'off',

        // Prevent usage of setState in componentDidUpdate
        'react/no-did-update-set-state': 'error',

        // Prevent direct mutation of this.state
        'react/no-direct-mutation-state': 'off',

        // Prevent usage of isMounted
        'react/no-is-mounted': 'error',

        // Prevent usage of the return value of React.render
        'react/no-render-return-value': 'error',

        // Prevent usage of setState
        'react/no-set-state': 'off',

        // Prevent using unknown DOM property
        // 'react/no-unknown-dom-property': 'error', // TODO: Check if this rule exists in current version

        // Prevent definitions of unused prop types
        'react/no-unused-prop-types': ['error', {
            customValidators: [],
            skipShapeProps: true,
        }],

        // Prevent usage of setState in componentWillUpdate
        'react/no-will-update-set-state': 'error',

        // Require render() methods to return something
        'react/require-render-return': 'error',

        // Prevent extra closing tags for components without children
        'react/self-closing-comp': 'error',

        // Enforce component methods order
        'react/sort-comp': ['error', {
            order: [
                'static-variables',
                'static-methods',
                'instance-variables',
                'lifecycle',
                '/^handle.+$/',
                '/^on.+$/',
                'getters',
                'setters',
                '/^(get|set)(?!(InitialState$|DefaultProps$|ChildContext$)).+$/',
                'instance-methods',
                'everything-else',
                'rendering',
            ],
            groups: {
                lifecycle: [
                    'displayName',
                    'propTypes',
                    'contextTypes',
                    'childContextTypes',
                    'mixins',
                    'statics',
                    'defaultProps',
                    'constructor',
                    'getDefaultProps',
                    'getInitialState',
                    'state',
                    'getChildContext',
                    'getDerivedStateFromProps',
                    'componentWillMount',
                    'UNSAFE_componentWillMount',
                    'componentDidMount',
                    'componentWillReceiveProps',
                    'UNSAFE_componentWillReceiveProps',
                    'shouldComponentUpdate',
                    'componentWillUpdate',
                    'UNSAFE_componentWillUpdate',
                    'getSnapshotBeforeUpdate',
                    'componentDidUpdate',
                    'componentDidCatch',
                    'componentWillUnmount',
                ],
                rendering: [
                    '/^render.+$/',
                    'render',
                ],
            },
        }],

        // Prevent missing parentheses around multilines JSX
        'react/jsx-wrap-multilines': ['error', {
            declaration: 'parens-new-line',
            assignment: 'parens-new-line',
            return: 'parens-new-line',
            arrow: 'parens-new-line',
            condition: 'parens-new-line',
            logical: 'parens-new-line',
            prop: 'parens-new-line',
        }],

        // Require that the first prop in a JSX element be on a new line when the element is multiline
        'react/jsx-first-prop-new-line': ['error', 'multiline-multiprop'],

        // Enforce spacing around jsx equals signs
        'react/jsx-equals-spacing': ['error', 'never'],

        // Disallow target="_blank" on links
        'react/jsx-no-target-blank': ['error', {enforceDynamicLinks: 'always'}],

        // require a shouldComponentUpdate method, or PureRenderMixin
        'react/require-optimization': ['off', {allowDecorators: []}],

        // Forbid certain props on Components
        'react/forbid-component-props': ['off', {forbid: []}],

        // Forbid certain elements
        'react/forbid-elements': ['off', {forbid: []}],

        // Prevent problem with children and props.dangerouslySetInnerHTML
        'react/no-danger-with-children': 'error',

        // Require style prop value be an object or var
        'react/style-prop-object': 'error',

        // Prevent invalid characters from appearing in markup
        'react/no-unescaped-entities': 'error',

        // Prevent usage of Array index in keys
        'react/no-array-index-key': 'error',

        // Enforce a defaultProps definition for every prop that is not a required prop.
        'react/require-default-props': ['error', {
            forbidDefaultForRequired: true,
        }],

        // Forbids using non-exported propTypes
        // this is intentionally set to "warn". it would be "error",
        // but it's only critical if you're stripping propTypes in production.
        'react/forbid-foreign-prop-types': ['warn', {allowInPropTypes: true}],

        // Prevent void DOM elements from receiving children
        'react/void-dom-elements-no-children': 'error',

        // Enforce all defaultProps have a corresponding non-required PropType
        'react/default-props-match-prop-types': ['error', {allowRequiredDefaults: false}],

        // Prevent usage of shouldComponentUpdate when extending React.PureComponent
        'react/no-redundant-should-component-update': 'error',

        // Prevent unused state values
        'react/no-unused-state': 'error',

        // Enforces consistent naming for boolean props
        'react/boolean-prop-naming': ['off', {
            propTypeNames: ['bool', 'mutuallyExclusiveTrueProps'],
            rule: '^(is|has)[A-Z]([A-Za-z0-9]?)+',
            message: '',
        }],

        // Prevents common casing typos
        'react/no-typos': 'error',

        // Enforce curly braces or disallow unnecessary curly braces in JSX props and/or children
        'react/jsx-curly-brace-presence': ['error', {props: 'never', children: 'never'}],

        // One JSX Element Per Line
        'react/jsx-one-expression-per-line': ['error', {allow: 'single-child'}],

        // Prevent using this.state within a this.setState
        'react/no-access-state-in-setstate': 'error',

        // Prevent usage of button elements without an explicit type attribute
        'react/button-has-type': ['error', {
            button: true,
            submit: true,
            reset: false,
        }],

        // Ensures inline tags are not rendered without spaces between them
        'react/jsx-child-element-spacing': 'off',

        // Prevent this from being used in stateless functional components
        'react/no-this-in-sfc': 'error',

        // Validate whitespace in and around the JSX opening and closing brackets
        'react/jsx-tag-spacing': ['error', {
            closingSlash: 'never',
            beforeSelfClosing: 'always',
            afterOpening: 'never',
            beforeClosing: 'never',
        }],

        // Enforce shorthand or standard form for React fragments
        'react/jsx-fragments': ['error', 'syntax'],

        // Enforce linebreaks in curly braces in JSX attributes and expressions.
        'react/jsx-curly-newline': ['error', {
            multiline: 'consistent',
            singleline: 'consistent',
        }],

        // Enforce state initialization style
        'react/state-in-constructor': ['error', 'always'],

        // Enforces where React component static properties should be positioned.
        'react/static-property-placement': ['error', 'property assignment'],

        // Disallow JSX props spreading
        'react/jsx-props-no-spreading': ['error', {
            html: 'enforce',
            custom: 'enforce',
            explicitSpread: 'ignore',
            exceptions: [],
        }],

        // Enforce that props are read-only
        'react/prefer-read-only-props': 'off',

        // Require that function components are named
        'react/jsx-no-script-url': ['error', [
            {
                name: 'Link',
                props: ['to'],
            },
        ]],

        // Disallow unnecessary fragments
        'react/jsx-no-useless-fragment': 'error',

        // Prevent adjacent inline elements not separated by whitespace.
        'react/no-adjacent-inline-elements': 'off',

        // Enforce a new line after jsx elements and expressions.
        'react/jsx-newline': 'off',

        // Prevent react contexts from taking non-stable values
        'react/jsx-no-constructed-context-values': 'error',

        // Prevent creating unstable components inside components
        'react/no-unstable-nested-components': 'error',

        // Enforce that namespaces are not used in React elements
        'react/jsx-no-leaked-render': 'error',

        // Enforce sandbox attribute on iframe elements
        'react/iframe-missing-sandbox': 'error',

        // Enforce that React hooks are called in the same order each time
        'react-hooks/rules-of-hooks': 'error',

        // Verify the list of the dependencies for Hooks like useEffect and similar
        'react-hooks/exhaustive-deps': 'warn',

        // Prevent using invalid attributes on HTML elements
        'react/no-invalid-html-attribute': 'error',

        // Prevent declaring unused methods of component class
        'react/no-unused-class-component-methods': 'error',
    },
};
