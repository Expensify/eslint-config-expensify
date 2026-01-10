import {defineConfig} from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';

const config = defineConfig([
    reactHooks.configs.flat.recommended,
    {
        rules: {
        // Core hooks rules
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            // React Compiler rules
            'react-hooks/config': 'warn',
            'react-hooks/error-boundaries': 'warn',
            'react-hooks/component-hook-factories': 'warn',
            'react-hooks/gating': 'warn',
            'react-hooks/globals': 'warn',
            'react-hooks/immutability': 'warn',
            'react-hooks/preserve-manual-memoization': 'warn',
            'react-hooks/purity': 'warn',
            'react-hooks/refs': 'warn',
            'react-hooks/set-state-in-effect': 'warn',
            'react-hooks/set-state-in-render': 'warn',
            'react-hooks/static-components': 'warn',
            'react-hooks/unsupported-syntax': 'warn',
            'react-hooks/use-memo': 'warn',
            'react-hooks/incompatible-library': 'warn',
        },
    },
]);

export default config;
