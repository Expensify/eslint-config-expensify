import {defineConfig} from 'eslint/config';
import globals from 'globals';

const config = defineConfig([{
    files: ['**/scripts/**', '**/server/**', '**/.github/**'],
    languageOptions: {
        globals: {
            ...globals.node,
        },
    },
    rules: {
        'no-console': 'off',
        'import/no-extraneous-dependencies': 'off',
        'react-hooks/rules-of-hooks': 'off',
        'react-hooks/exhaustive-deps': 'off',
        'react/jsx-filename-extension': 'off',
        'react/jsx-uses-react': 'off',
        'react/react-in-jsx-scope': 'off',
    },
}]);

export default config;
