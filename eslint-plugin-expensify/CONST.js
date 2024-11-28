/* eslint-disable max-len */
module.exports = {
    MESSAGE: {
        DISPLAY_NAME_PROPERTY_CLASS:
            'Class components must not set the displayName property.',
        DISPLAY_NAME_PROPERTY_FUNCTION:
            'Function components must set the displayName property.',
        NO_API_IN_VIEWS:
            'Do not call API directly outside of actions methods. Only actions should make API requests.',
        NO_INLINE_NAMED_EXPORT: 'Do not inline named exports.',
        NO_NEGATED_VARIABLES: 'Do not use negated variable names.',
        NO_THENABLE_ACTIONS_IN_VIEWS:
            'Calling .then() on action method {{method}} is forbidden in React views. Relocate this logic into the actions file and pass values via Onyx.',
        NO_USELESS_COMPOSE:
            'compose() is not necessary when passed a single argument',
        NO_MULTIPLE_ONYX_IN_FILE:
            'Only use withOnyx() once. Read here about how to properly work with dependent Onyx keys: https://github.com/Expensify/react-native-onyx#dependent-onyx-keys-and-withonyx',
        PREFER_ACTIONS_SET_DATA:
            'Only actions should directly set or modify Onyx data. Please move this logic into a suitable action.',
        PREFER_EARLY_RETURN:
            'Prefer an early return to a conditionally-wrapped function body',
        PREFER_IMPORT_MODULE_CONTENTS:
            "Do not import individual exports from local modules. Prefer 'import * as' syntax.",
        PREFER_ONYX_CONNECT_IN_LIBS:
            'Only call Onyx.connect() from inside a /src/libs/** file. React components and non-library code should not use Onyx.connect()',
        PREFER_UNDERSCORE_METHOD:
            "Prefer '_.{{method}}' over the native function.",
        PREFER_STR_METHOD: "Prefer 'Str.{{method}}' over the native function.",
        PREFER_LOCALIZATION:
            "Use Localize.translateLocal('i18n.key') over hard coded messages.",
        NO_MULTIPLE_API_CALLS:
            'Do not call API multiple times in the same method. The API response should return all the necessary data in a single request, and API calls should not be chained together.',
        NO_CALL_ACTIONS_FROM_ACTIONS:
            'Calling actions from inside other actions is forbidden. If an action needs to call another action combine the two actions into a singular API call instead.',
        NO_API_SIDE_EFFECTS_METHOD: 'Do not use makeRequestWithSideEffects.',
        PROP_TYPE_REQUIRED_FALSE:
            'Prop {{key}} should not be explicitly required.',
        PROP_TYPE_NOT_DECLARED: 'Prop {{key}} must be declared in propTypes.',
        PROP_DEEFAULT_NOT_DECLARED: 'Prop {{key}} must have a default value.',
        HAVE_PROP_TYPES: 'Component must have prop types declared.',
        HAVE_DEFAULT_PROPS: 'Component must have default prop values.',
        ONYX_ONE_PARAM:
            'The withOnyx HOC must be passed at least one argument.',
        MUST_USE_VARIABLE_FOR_ASSIGNMENT:
            '{{key}} must be assigned as a variable instead of direct assignment.',
        NO_DEFAULT_PROPS:
            'defaultProps should not be used in function components. Use default Arguments instead.',
        USE_PERIODS_ERROR_MESSAGES: 'Use periods at the end of error messages.',
        USE_DOUBLE_NEGATION_INSTEAD_OF_BOOLEAN: 'Use !! instead of Boolean().',
        NO_ACC_SPREAD_IN_REDUCE:
            'Avoid a use of spread (`...`) operator on accumulators in reduce callback. Mutate them directly instead.',
        PREFER_TYPE_FEST_TUPLE_TO_UNION:
            'Prefer using `TupleToUnion` from `type-fest` for converting tuple types to union types.',
        PREFER_TYPE_FEST_VALUE_OF:
            'Prefer using `ValueOf` from `type-fest` to extract the type of the properties of an object.',
        PREFER_AT: 'Prefer using the `.at()` method for array element access.',
        PREFER_SHOULD_USE_NARROW_LAYOUT_INSTEAD_OF_IS_SMALL_SCREEN_WIDTH:
            'Prefer using `shouldUseNarrowLayout` instead of `isSmallScreenWidth` from `useResponsiveLayout`.',
        NO_USE_STATE_INITIALIZER_CALL_FUNCTION:
            'Avoid calling a function directly in the useState initializer. Use an initializer function instead (a callback).',
    },
};
