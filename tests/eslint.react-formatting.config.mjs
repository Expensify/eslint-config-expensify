import babelParser from '@babel/eslint-parser';
import react from '../configs/react.js';
import reactFormatting from '../configs/react-formatting.js';

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
