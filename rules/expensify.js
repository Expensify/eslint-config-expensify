module.exports = {
    rules: {
        'rulesdir/no-negated-variables': 'error',
        'rulesdir/no-api-in-views': 'error',
        'rulesdir/prefer-actions-set-data': 'error',
        'rulesdir/prefer-onyx-connect-in-libs': 'error',
        'rulesdir/no-thenable-actions-in-views': 'error',
        'rulesdir/prefer-early-return': 'error',
        'rulesdir/no-inline-named-export': 'error',
        'rulesdir/prefer-underscore-method': 'error',
        'rulesdir/no-useless-compose': 'error',
        'rulesdir/prefer-import-module-contents': 'error',
        'rulesdir/no-multiple-api-calls': 'error',
        'rulesdir/no-api-side-effects-method': 'error',
        'no-restricted-imports': ['error', {
            paths: [{
                name: 'react-native',
                importNames: ['Button', 'Text', 'TextInput', 'Picker'],
                message: 'Please use an Expensify component from src/components/ instead.',
            }],
        }],
    },
};
