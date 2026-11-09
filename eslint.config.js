import {defineConfig, globalIgnores} from 'eslint/config';
import indexConfig from './index.js';
import formatting from './configs/public/formatting.js';
import jestConfig from './configs/public/jest.js';
import reactFormatting from './configs/public/react-formatting.js';

/**
 * Configuration to lint this project's own code, not for external use.
 */
const config = defineConfig([
    globalIgnores(['**/node_modules/**', 'tests/oxlint/fixtures/**']),
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
        // Tooling that runs on modern Node only, so the legacy-app rules (no `??` or `?.`, underscore methods) do not apply.
        files: ['oxlint/**', 'scripts/**', 'tests/oxlint/**'],
        rules: {
            'es/no-nullish-coalescing-operators': 'off',
            'es/no-optional-chaining': 'off',
            'rulesdir/prefer-underscore-method': 'off',
            'no-await-in-loop': 'off',
            'import/prefer-default-export': 'off',
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
