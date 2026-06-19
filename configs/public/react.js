import {defineConfig} from 'eslint/config';
import jsxA11Y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

const config = defineConfig([
    // ─── React core rules ────────────────────────────────────────────────────────
    {
        plugins: {
            react: reactPlugin,
        },

        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },

        // View link below for react rules documentation
        // https://github.com/yannickcr/eslint-plugin-react#list-of-supported-rules
        rules: {
            'no-underscore-dangle': ['error', {
                allow: ['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__'],
                allowAfterThis: false,
                allowAfterSuper: false,
                enforceInMethodNames: true,
            }],

            // Prevent missing displayName in a React component definition
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/display-name.md
            'react/display-name': ['off', {ignoreTranspilerName: false}],

            // Forbid certain propTypes (any, array, object)
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/forbid-prop-types.md
            'react/forbid-prop-types': ['error', {
                forbid: ['any', 'array', 'object'],
                checkContextTypes: true,
                checkChildContextTypes: true,
            }],

            // Forbid certain props on DOM Nodes
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/forbid-dom-props.md
            'react/forbid-dom-props': ['off', {forbid: []}],

            // Enforce boolean attributes notation in JSX
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-boolean-value.md
            'react/jsx-boolean-value': ['error', 'never', {always: []}],

            // Enforce event handler naming conventions in JSX
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-handler-names.md
            'react/jsx-handler-names': ['off', {
                eventHandlerPrefix: 'handle',
                eventHandlerPropPrefix: 'on',
            }],

            // Validate JSX has key prop when in array or iterator
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-key.md
            // Turned off because it has too many false positives
            'react/jsx-key': 'off',

            // Prevent usage of .bind() in JSX props
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-bind.md
            'react/jsx-no-bind': ['error', {
                ignoreRefs: true,
                allowArrowFunctions: true,
                allowFunctions: false,
                allowBind: false,
                ignoreDOMComponents: true,
            }],

            // Prevent duplicate props in JSX
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-duplicate-props.md
            'react/jsx-no-duplicate-props': ['error', {ignoreCase: true}],

            // Prevent usage of unwrapped JSX strings
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-literals.md
            'react/jsx-no-literals': ['off', {noStrings: true}],

            // Disallow undeclared variables in JSX
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-undef.md
            'react/jsx-no-undef': ['error', {
                allowGlobals: true,
            }],

            // Enforce PascalCase for user-defined JSX components
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-pascal-case.md
            'react/jsx-pascal-case': ['error', {
                allowAllCaps: true,
                ignore: [],
            }],

            // Enforce propTypes declarations alphabetical sorting
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/sort-prop-types.md
            'react/sort-prop-types': ['off', {
                ignoreCase: true,
                callbacksLast: false,
                requiredFirst: false,
                sortShapeProp: true,
            }],

            // Deprecated in favor of react/jsx-sort-props
            'react/jsx-sort-prop-types': 'off',

            // Enforce props alphabetical sorting
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-sort-props.md
            'react/jsx-sort-props': ['off', {
                ignoreCase: true,
                callbacksLast: false,
                shorthandFirst: false,
                shorthandLast: false,
                noSortAlphabetically: false,
                reservedFirst: true,
            }],

            // Enforce defaultProps declarations alphabetical sorting
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/jsx-sort-default-props.md
            'react/jsx-sort-default-props': ['off', {
                ignoreCase: true,
            }],

            // Prevent React to be incorrectly marked as unused
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-uses-react.md
            'react/jsx-uses-react': ['error'],

            // Prevent variables used in JSX to be incorrectly marked as unused
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-uses-vars.md
            'react/jsx-uses-vars': 'error',

            // Prevent usage of dangerous JSX properties
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-danger.md
            'react/no-danger': 'error',

            // Prevent usage of deprecated methods
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-deprecated.md
            'react/no-deprecated': ['error'],

            // Prevent usage of setState in componentDidMount
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-did-mount-set-state.md
            // this is necessary for server-rendering
            'react/no-did-mount-set-state': 'off',

            // Prevent usage of setState in componentDidUpdate
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-did-update-set-state.md
            'react/no-did-update-set-state': 'error',

            // Prevent usage of setState in componentWillUpdate
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-will-update-set-state.md
            'react/no-will-update-set-state': 'error',

            // Prevent direct mutation of this.state
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-direct-mutation-state.md
            'react/no-direct-mutation-state': 'off',

            // Prevent usage of isMounted
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-is-mounted.md
            'react/no-is-mounted': 'error',

            'react/no-multi-comp': 'off',
            'react/no-set-state': 'off',

            // Prevent using string references
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-string-refs.md
            'react/no-string-refs': 'error',

            // Prevent usage of unknown DOM property
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-unknown-property.md
            'react/no-unknown-property': 'error',

            // Require ES6 class declarations over React.createClass
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/prefer-es6-class.md
            'react/prefer-es6-class': ['error', 'always'],

            // Require stateless functions when not using lifecycle methods, setState or ref
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/prefer-stateless-function.md
            'react/prefer-stateless-function': ['error', {ignorePureComponents: true}],

            // Prevent missing props validation in a React component definition
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/prop-types.md
            'react/prop-types': ['error', {
                ignore: [],
                customValidators: [],
                skipUndeclared: false,
            }],

            // Do not prevent missing React when using JSX
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/react-in-jsx-scope.md
            'react/react-in-jsx-scope': 'off',

            // Require render() methods to return something
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/require-render-return.md
            'react/require-render-return': 'error',

            // Prevent extra closing tags for components without children
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/self-closing-comp.md
            'react/self-closing-comp': 'error',

            // Enforce component methods order
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/sort-comp.md
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

            // Disallow target="_blank" on links
            // https://github.com/yannickcr/eslint-plugin-react/blob/ac102885765be5ff37847a871f239c6703e1c7cc/docs/rules/jsx-no-target-blank.md
            'react/jsx-no-target-blank': ['error', {enforceDynamicLinks: 'always'}],

            // .js, .jsx, .tsx files may have JSX. Not .ts
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-filename-extension.md
            'react/jsx-filename-extension': [1, {extensions: ['.js', '.jsx', '.tsx']}],

            // prevent accidental JS comments from being injected into JSX as text
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-comment-textnodes.md
            'react/jsx-no-comment-textnodes': 'error',

            // disallow using React.render/ReactDOM.render's return value
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-render-return-value.md
            'react/no-render-return-value': 'error',

            // require a shouldComponentUpdate method, or PureRenderMixin
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/require-optimization.md
            'react/require-optimization': ['off', {allowDecorators: []}],

            // warn against using findDOMNode()
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-find-dom-node.md
            'react/no-find-dom-node': 'error',

            // Forbid certain props on Components
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/forbid-component-props.md
            'react/forbid-component-props': ['off', {forbid: []}],

            // Forbid certain elements
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/forbid-elements.md
            'react/forbid-elements': ['off', {forbid: []}],

            // Prevent using Array index in keys
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-array-index-key.md
            'react/no-array-index-key': 'error',

            // Enforce a defaultProps definition for every prop that is not a required prop
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/require-default-props.md
            'react/require-default-props': ['error', {
                forbidDefaultForRequired: true,
            }],

            // Forbids using non-exported propTypes
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/forbid-foreign-prop-types.md
            'react/forbid-foreign-prop-types': ['error', {allowInPropTypes: true}],

            // Prevent void DOM elements from receiving children
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/void-dom-elements-no-children.md
            'react/void-dom-elements-no-children': 'error',

            // Enforce all defaultProps have a corresponding non-required PropType
            // https://github.com/yannickcr/eslint-plugin-react/blob/9e13ae2c51e44872b45cc15bf1ac3a72105bdd0e/docs/rules/default-props-match-prop-types.md
            'react/default-props-match-prop-types': ['error', {allowRequiredDefaults: false}],

            // Prevent usage of shouldComponentUpdate when extending React.PureComponent
            // https://github.com/yannickcr/eslint-plugin-react/blob/9e13ae2c51e44872b45cc15bf1ac3a72105bdd0e/docs/rules/no-redundant-should-component-update.md
            'react/no-redundant-should-component-update': 'error',

            // Prevent unused state values
            // https://github.com/yannickcr/eslint-plugin-react/pull/1103/
            'react/no-unused-state': 'error',

            // Enforces consistent naming for boolean props
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/boolean-prop-naming.md
            'react/boolean-prop-naming': ['off', {
                propTypeNames: ['bool', 'mutuallyExclusiveTrueProps'],
                rule: '^(is|has)[A-Z]([A-Za-z0-9]?)+',
                message: '',
            }],

            // Prevents common casing typos
            // https://github.com/yannickcr/eslint-plugin-react/blob/73abadb697034b5ccb514d79fb4689836fe61f91/docs/rules/no-typos.md
            'react/no-typos': 'error',

            // Do not enforce consistent usage of destructuring assignment of props, state, and context
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/destructuring-assignment.md
            'react/destructuring-assignment': ['off', 'always'],

            // Prevent using this.state within a this.setState
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/no-access-state-in-setstate.md
            'react/no-access-state-in-setstate': 'error',

            // Prevent usage of button elements without an explicit type attribute
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/button-has-type.md
            'react/button-has-type': ['error', {
                button: true,
                submit: true,
                reset: false,
            }],

            'react/jsx-child-element-spacing': 'off',

            // Prevent this from being used in stateless functional components
            // https://github.com/yannickcr/eslint-plugin-react/blob/843d71a432baf0f01f598d7cf1eea75ad6896e4b/docs/rules/no-this-in-sfc.md
            'react/no-this-in-sfc': 'error',

            'react/jsx-max-depth': 'off',
            'react/jsx-props-no-multi-spaces': 'off',

            // New versions of react are removing some methods, and those methods have been prefixed with "UNSAFE_" for now.
            // https://github.com/yannickcr/eslint-plugin-react/blob/157cc932be2cfaa56b3f5b45df6f6d4322a2f660/docs/rules/no-unsafe.md
            'react/no-unsafe': ['error', {
                checkAliases: true,
            }],

            // Enforce shorthand or standard form for React fragments
            // https://github.com/yannickcr/eslint-plugin-react/blob/bc976b837abeab1dffd90ac6168b746a83fc83cc/docs/rules/jsx-fragments.md
            'react/jsx-fragments': ['error', 'syntax'],

            // Enforce state initialization style
            'react/state-in-constructor': ['error', 'always'],

            // Enforces where React component static properties should be positioned
            'react/static-property-placement': ['error', 'property assignment'],

            'react/prefer-read-only-props': 'off',

            // Prevent usage of `javascript:` URLs
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-script-url.md
            'react/jsx-no-script-url': ['error', [
                {
                    name: 'Link',
                    props: ['to'],
                },
            ]],

            // Disallow unnecessary fragments
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-useless-fragment.md
            'react/jsx-no-useless-fragment': 'error',

            'react/no-adjacent-inline-elements': 'off',

            // Enforce a specific function type for function components
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/function-component-definition.md
            'react/function-component-definition': [
                'error',
                {
                    namedComponents: 'function-declaration',
                    unnamedComponents: 'arrow-function',
                },
            ],

            'react/jsx-newline': 'off',

            // Prevent react contexts from taking non-stable values
            // https://github.com/yannickcr/eslint-plugin-react/blob/e2eaadae316f9506d163812a09424eb42698470a/docs/rules/jsx-no-constructed-context-values.md
            'react/jsx-no-constructed-context-values': 'error',

            // Prevent creating unstable components inside components
            // https://github.com/yannickcr/eslint-plugin-react/blob/c2a790a3472eea0f6de984bdc3ee2a62197417fb/docs/rules/no-unstable-nested-components.md
            'react/no-unstable-nested-components': 'error',

            'react/no-namespace': 'error',
            'react/prefer-exact-props': 'error',
            'react/no-arrow-function-lifecycle': 'error',
            'react/no-invalid-html-attribute': 'error',
            'react/no-unused-class-component-methods': 'error',

            // Enforce style prop to be an object or a variable
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/style-prop-object.md
            'react/style-prop-object': 'error',

            // Prevent invalid characters from appearing in markup
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-unescaped-entities.md
            'react/no-unescaped-entities': 'error',

            // Prevent passing of children as props
            // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-children-prop.md
            'react/no-children-prop': 'error',
        },

        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.jsx', '.json'],
                },
            },
            react: {
                pragma: 'React',
                version: 'detect',
            },
            propWrapperFunctions: [
                'forbidExtraProps', // https://www.npmjs.com/package/airbnb-prop-types
                'exact', // https://www.npmjs.com/package/prop-types-exact
                'Object.freeze', // https://tc39.github.io/ecma262/#sec-object.freeze
            ],
        },
    },

    // ─── React Hooks ─────────────────────────────────────────────────────────────
    reactHooks.configs.flat.recommended,
    {
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',

            // React Compiler rules
            'react-hooks/config': 'error',
            'react-hooks/error-boundaries': 'error',
            'react-hooks/component-hook-factories': 'error',
            'react-hooks/gating': 'error',
            'react-hooks/globals': 'error',
            'react-hooks/immutability': 'error',
            'react-hooks/preserve-manual-memoization': 'error',
            'react-hooks/purity': 'error',
            'react-hooks/refs': 'error',
            'react-hooks/set-state-in-effect': 'error',
            'react-hooks/set-state-in-render': 'error',
            'react-hooks/static-components': 'error',
            'react-hooks/unsupported-syntax': 'error',
            'react-hooks/use-memo': 'error',
            'react-hooks/incompatible-library': 'error',
        },
    },

    // ─── Accessibility ───────────────────────────────────────────────────────────
    {
        plugins: {
            'jsx-a11y': jsxA11Y,
        },

        rules: {
            // disabled; rule is deprecated
            'jsx-a11y/accessible-emoji': 'off',

            // Enforce that all elements that require alternative text have meaningful information
            // https://github.com/evcohen/eslint-plugin-jsx-a11y/blob/master/docs/rules/alt-text.md
            'jsx-a11y/alt-text': ['error', {
                elements: ['img', 'object', 'area', 'input[type="image"]'],
                img: [],
                object: [],
                area: [],
                'input[type="image"]': [],
            }],

            'jsx-a11y/anchor-has-content': ['error', {components: []}],
            'jsx-a11y/anchor-is-valid': ['error', {
                components: ['Link'],
                specialLink: ['to'],
                aspects: ['noHref', 'invalidHref', 'preferButton'],
            }],
            'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
            'jsx-a11y/aria-props': 'error',
            'jsx-a11y/aria-proptypes': 'error',
            'jsx-a11y/aria-role': ['error', {ignoreNonDOM: false}],
            'jsx-a11y/aria-unsupported-elements': 'error',
            'jsx-a11y/autocomplete-valid': ['off', {inputComponents: []}],

            // require onClick be accompanied by onKeyUp/onKeyDown/onKeyPress
            'jsx-a11y/click-events-have-key-events': 'off',

            'jsx-a11y/control-has-associated-label': ['error', {
                labelAttributes: ['label'],
                controlComponents: [],
                ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'tr', 'video'],
                ignoreRoles: ['grid', 'listbox', 'menu', 'menubar', 'radiogroup', 'row', 'tablist', 'toolbar', 'tree', 'treegrid'],
                depth: 5,
            }],

            'jsx-a11y/heading-has-content': ['error', {components: ['']}],
            'jsx-a11y/html-has-lang': 'error',
            'jsx-a11y/iframe-has-title': 'error',
            'jsx-a11y/img-redundant-alt': 'error',
            'jsx-a11y/interactive-supports-focus': 'error',

            // By default, this rule makes us use both "for" attributes and nest inputs inside of
            // labels. We would rather just do either since browsers don't have a preference.
            'jsx-a11y/label-has-associated-control': ['error', {
                labelComponents: [],
                labelAttributes: [],
                controlComponents: [],
                assert: 'either',
                depth: 25,
            }],

            'jsx-a11y/lang': 'error',
            'jsx-a11y/media-has-caption': ['error', {audio: [], video: [], track: []}],
            'jsx-a11y/mouse-events-have-key-events': 'error',
            'jsx-a11y/no-access-key': 'error',
            'jsx-a11y/no-autofocus': ['error', {ignoreNonDOM: true}],
            'jsx-a11y/no-distracting-elements': ['error', {elements: ['marquee', 'blink']}],
            'jsx-a11y/no-interactive-element-to-noninteractive-role': ['error', {tr: ['none', 'presentation']}],
            'jsx-a11y/no-noninteractive-element-interactions': ['error', {
                handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'],
            }],
            'jsx-a11y/no-noninteractive-element-to-interactive-role': ['error', {
                ul: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
                ol: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
                li: ['menuitem', 'option', 'row', 'tab', 'treeitem'],
                table: ['grid'],
                td: ['gridcell'],
            }],
            'jsx-a11y/no-noninteractive-tabindex': ['error', {tags: [], roles: ['tabpanel']}],
            'jsx-a11y/no-onchange': 'off',
            'jsx-a11y/no-redundant-roles': 'error',
            'jsx-a11y/no-static-element-interactions': ['error', {
                handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'],
            }],
            'jsx-a11y/role-has-required-aria-props': 'error',
            'jsx-a11y/role-supports-aria-props': 'error',
            'jsx-a11y/scope': 'error',
            'jsx-a11y/tabindex-no-positive': 'error',

            // deprecated: replaced by `label-has-associated-control`
            'jsx-a11y/label-has-for': ['off', {
                components: [],
                required: {
                    every: ['nesting', 'id'],
                },
                allowChildren: false,
            }],
        },
    },
]);

export default config;
