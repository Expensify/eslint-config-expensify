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
    },
}]);

export default config;
