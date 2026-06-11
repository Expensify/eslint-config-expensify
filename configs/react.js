import {defineConfig} from 'eslint/config';
import globals from 'globals';

import react from '../rules/react.js';
import reactHooks from '../rules/react-hooks.js';
import reactA11y from '../rules/react-a11y.js';

const config = defineConfig([
    react,
    reactA11y,
    reactHooks,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },
]);

export default config;
