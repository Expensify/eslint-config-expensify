import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';

import typescriptAirbnb from '../private/typescript-airbnb.js';
import typescriptRules from '../private/typescript-rules.js';

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'];
const jsFiles = ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'];

const scopedRecommendedTypeChecked = tseslint.configs.recommendedTypeChecked.map((block) => ({
    ...block,
    files: block.files || tsFiles,
}));

const scopedStylisticTypeChecked = tseslint.configs.stylisticTypeChecked.map((block) => ({
    ...block,
    files: block.files || tsFiles,
}));

const config = defineConfig([
    ...scopedRecommendedTypeChecked,
    ...scopedStylisticTypeChecked,
    ...typescriptAirbnb,
    {
        files: tsFiles,
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                projectService: true,
            },
        },
    },
    ...typescriptRules,
    {
        files: jsFiles,
        ...tseslint.configs.disableTypeChecked,
    },
]);

export default config;
