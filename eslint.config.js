import {defineConfig} from 'eslint/config';
import indexConfig from './index.js';

/**
 * Configuration to lint this project's own code, not for external use.
 */
const config = defineConfig([
    indexConfig,
    {
        files: ['**/*.test.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
            },
        },
    },
    {
        rules: {
            'import/extensions': ['error', 'ignorePackages', {
                js: 'always',
            }],
            'expensify/prefer-import-module-contents': 'off',

            // Workaround: ESLint 10 compatibility with some rules/plugins
            indent: 'off',
            'import/order': 'off',
        },
    },
]);

export default config;
