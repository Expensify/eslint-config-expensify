import {defineConfig} from 'eslint/config';
import globals from 'globals';

const config = defineConfig([{
    languageOptions: {
        globals: {
            ...globals.browser,
        },
    },
}]);

export default config;
