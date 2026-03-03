import {defineConfig} from 'eslint/config';

const config = defineConfig([{
    rules: {
        'expensify/no-negated-variables': 'error',
        'expensify/no-api-in-views': 'error',
        'expensify/no-onyx-connect': 'warn',
        'expensify/prefer-actions-set-data': 'error',
        'expensify/prefer-onyx-connect-in-libs': 'error',
        'expensify/no-thenable-actions-in-views': 'error',
        'expensify/prefer-early-return': 'error',
        'expensify/no-inline-named-export': 'error',
        'expensify/prefer-underscore-method': 'error',
        'expensify/no-useless-compose': 'error',
        'expensify/prefer-import-module-contents': 'error',
        'expensify/no-multiple-api-calls': 'error',
        'expensify/no-multiple-onyx-in-file': 'error',
        'expensify/no-call-actions-from-actions': 'error',
        'expensify/no-api-side-effects-method': 'error',
        'expensify/no-deep-equal-in-memo': 'error',
        'expensify/prefer-localization': 'error',
        'expensify/use-double-negation-instead-of-boolean': 'error',
        'expensify/no-acc-spread-in-reduce': 'error',
        'no-restricted-imports': ['error', {
            paths: [{
                name: 'react-native',
                importNames: ['Button', 'Text', 'TextInput', 'Picker'],
                message: 'Please use an Expensify component from src/components/ instead.',
            }, {
                name: 'react-native',
                importNames: ['SafeAreaView'],
                message: 'Please use SafeAreaView from react-native-safe-area-context',
            }],
        }],
        'expensify/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth': 'warn',
        'expensify/no-use-state-initializer-functions': 'error',
        'expensify/no-unstable-hook-defaults': 'error',
        'expensify/no-inline-useOnyx-selector': 'error',
        'expensify/no-set-or-map-return-in-useOnyx-selector': 'error',
        'expensify/prefer-narrow-hook-dependencies': 'error',
    },
}]);

export default config;
