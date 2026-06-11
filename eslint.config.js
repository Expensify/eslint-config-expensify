import {defineConfig} from 'eslint/config';
import indexConfig from './index.js';
import formatting from './configs/public/formatting.js';
import reactFormatting from './configs/public/react-formatting.js';

/**
 * Configuration to lint this project's own code, not for external use.
 */
const config = defineConfig([
    indexConfig,
    formatting,
    reactFormatting,
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
