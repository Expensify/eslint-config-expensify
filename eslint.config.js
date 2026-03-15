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

            // Disabled when linting this repo only; import style here is acceptable.
            'expensify/prefer-import-module-contents': 'off',

            // ESLint 10 compatibility: indent and import/order throw at runtime with current
            // parser/plugin versions (e.g. indent "reading 'range' of undefined",
            // import/order "getTokenOrCommentBefore is not a function"). Re-enable when
            // upstream fixes land.
            indent: 'off',
            'import/order': 'off',
        },
    },
]);

export default config;
