import {defineConfig} from 'eslint/config';
import indexConfig from './index.js';

const config = defineConfig([
    indexConfig,
    {
        files: ['./eslint.config.js', './hooks.js', './index.js', './rules/**/*.js'],
        rules: {
            'import/extensions': ['error', 'ignorePackages', {
                js: 'always',
            }],
        },
    },
]);

export default config;
