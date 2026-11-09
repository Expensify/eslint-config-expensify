import {defineConfig, globalIgnores} from 'eslint/config';
import indexConfig from './index.js';
import formatting from './configs/public/formatting.js';
import jestConfig from './configs/public/jest.js';
import reactFormatting from './configs/public/react-formatting.js';

/**
 * Configuration to lint this project's own code, not for external use.
 */
const config = defineConfig([
    globalIgnores(['**/node_modules/**', 'tests/oxlint/fixtures/**', '**/*.d.mts']),
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
        // Tooling that runs on modern Node only: it uses `??` (26 places), `?.` (25) and native array methods (88), which the
        // legacy-app rules refuse. Rewriting them to fit would make this code worse.
        files: ['oxlint/**', 'scripts/**', 'tests/oxlint/**'],
        rules: {
            'es/no-nullish-coalescing-operators': 'off',
            'es/no-optional-chaining': 'off',
            'rulesdir/prefer-underscore-method': 'off',
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
