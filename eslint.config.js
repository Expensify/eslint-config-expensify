import {defineConfig, globalIgnores} from 'eslint/config';
import indexConfig from './index.js';
import formatting from './configs/public/formatting.js';
import jestConfig from './configs/public/jest.js';
import reactFormatting from './configs/public/react-formatting.js';

/**
 * Configuration to lint this project's own code, not for external use.
 */
const config = defineConfig([
    globalIgnores(['**/node_modules/**']),
    indexConfig,
    formatting,
    reactFormatting,
    ...jestConfig,
    {
        rules: {
            'import/extensions': ['error', 'ignorePackages', {
                js: 'always',
            }],
            'rulesdir/prefer-import-module-contents': 'off',
        },
    },
    {
        files: ['eslint-plugin-expensify/fixtures/**/*'],
        rules: {
            '@typescript-eslint/prefer-nullish-coalescing': 'off',
        },
    },
]);

export default config;
