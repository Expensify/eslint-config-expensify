import {defineConfig} from 'eslint/config';

const config = defineConfig([{
    files: ['**/scripts/**', '**/server/**', '**/.github/**'],
    rules: {
        'no-console': 'off',
        'import/no-extraneous-dependencies': 'off',
    },
}]);

export default config;
