module.exports = {
    MESSAGE: {
        NO_API_IN_VIEWS: 'Do not call API directly outside of actions methods. Only actions should make API requests.',
        NO_INLINE_NAMED_EXPORT: 'Do not inline named exports.',
        NO_NEGATED_VARIABLES: 'Do not use negated variable names.',
        NO_THENABLE_ACTIONS_IN_VIEWS: 'Calling .then() on action method {{method}} is forbidden in React views. Relocate this logic into the actions file and pass values via Onyx.',
        NO_USELESS_COMPOSE: 'compose() is not necessary when passed a single argument',
        PREFER_ACTIONS_SET_DATA: 'Only actions should directly set or modify Onyx data. Please move this logic into a suitable action.',
        PREFER_EARLY_RETURN: 'Prefer an early return to a conditionally-wrapped function body',
        PREFER_IMPORT_MODULE_CONTENTS: 'Do not import individual exports from local modules. Prefer \'import * as\' syntax.',
        PREFER_ONYX_CONNECT_IN_LIBS: 'Only call Onyx.connect() from inside a /src/libs/** file. React components and non-library code should not use Onyx.connect()',
        PREFER_UNDERSCORE_METHOD: 'Prefer \'_.{{method}}\' over the native function.',
        PREFER_STR_METHOD: 'Prefer \'Str.{{method}}\' over the native function.',
        NO_MULTIPLE_API_CALLS: 'Do not call API or deprecatedAPI multiple times in the same method. The API response should return all the necessary data in a single request.',
    },
};
