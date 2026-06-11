import {defineConfig, globalIgnores} from 'eslint/config';
import globals from 'globals';
import indexConfig from './index.js';
import formatting from './configs/formatting.js';
import reactFormatting from './configs/react-formatting.js';

/**
 * Configuration to lint this project's own code, not for external use.
 */
const config = defineConfig([
    globalIgnores(['tests/fixtures/**']),
    indexConfig,
    formatting,
    reactFormatting,
    {
        files: ['tests/**/*.test.js'],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
        rules: {
            'rulesdir/prefer-underscore-method': 'off',
        },
    },
    {
        rules: {
            'import/extensions': ['error', 'ignorePackages', {
                js: 'always',
            }],
            'rulesdir/prefer-import-module-contents': 'off',
        },
    },
]);

export default config;
