import babelParser from '@babel/eslint-parser';
import react from '../configs/public/react.js';
import reactFormatting from '../configs/public/react-formatting.js';

export default [
    ...react,
    ...reactFormatting,
    {
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    babelrc: false,
                    configFile: false,
                    parserOpts: {
                        plugins: ['jsx'],
                    },
                },
            },
        },
    },
];
