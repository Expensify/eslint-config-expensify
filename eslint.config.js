import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import {defineConfig} from 'eslint/config';
import indexConfig from './index.js';

/**
 * Configuration to lint this project's own code, not for external use.
 */
const config = defineConfig([
    indexConfig,
    eslintPluginPrettierRecommended,
    {
        rules: {
            'import/extensions': [
                'error',
                'ignorePackages',
                {
                    js: 'always',
                },
            ],
            'rulesdir/prefer-import-module-contents': 'off',
        },
    },
]);

export default config;
