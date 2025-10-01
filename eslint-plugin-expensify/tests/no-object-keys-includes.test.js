import {RuleTester} from '@typescript-eslint/rule-tester';
import {fileURLToPath} from 'url';
import parser from '@typescript-eslint/parser';
import path from 'path';
import * as rule from '../no-object-keys-includes.js';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const tsconfigRootDir = path.resolve(dirname, '../fixtures');

const ruleTester = new RuleTester({
    languageOptions: {
        parser,
        parserOptions: {
            project: './tsconfig.json',
            tsconfigRootDir,
            sourceType: 'module',
            ecmaVersion: 2024,
        },
    },
});

ruleTester.run('no-object-keys-includes', rule, {
    valid: [
        // Using 'in' operator (preferred)
        {
            code: 'if (key in object) { console.log("found"); }',
        },

        // Using bracket notation
        {
            code: 'if (!!object[key]) { console.log("found"); }',
        },

        // Using hasOwnProperty
        {
            code: 'if (object.hasOwnProperty(key)) { console.log("found"); }',
        },

        // Object.keys used for other purposes
        {
            code: 'const keys = Object.keys(object); keys.forEach(key => console.log(key));',
        },

        // Object.keys with length
        {
            code: 'if (Object.keys(object).length > 0) { console.log("has keys"); }',
        },

        // Object.keys with forEach
        {
            code: 'Object.keys(object).forEach(key => console.log(key));',
        },

        // Array includes (not Object.keys)
        {
            code: 'if (array.includes(item)) { console.log("found"); }',
        },

        // Object.keys with map
        {
            code: 'const mapped = Object.keys(object).map(key => object[key]);',
        },

        // Object.keys with filter
        {
            code: 'const filtered = Object.keys(object).filter(key => key.startsWith("prefix"));',
        },
    ],
    invalid: [
        // Basic Object.keys().includes() pattern
        {
            code: 'if (Object.keys(policyRates).includes(customUnitRateID)) { console.log("found"); }',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'policyRates',
                    key: 'customUnitRateID',
                },
            }],
            output: 'if (customUnitRateID in policyRates) { console.log("found"); }',
        },

        // Nested object property
        {
            code: 'Object.keys(data.config).includes("setting")',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'data.config',
                    key: '"setting"',
                },
            }],
            output: '"setting" in data.config',
        },

        // Variable as key
        {
            code: 'const exists = Object.keys(typeFiltersKeys).includes(currentType);',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'typeFiltersKeys',
                    key: 'currentType',
                },
            }],
            output: 'const exists = currentType in typeFiltersKeys;',
        },

        // Negated pattern
        {
            code: 'if (!Object.keys(obj).includes(key)) { throw new Error(); }',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'obj',
                    key: 'key',
                },
            }],
            output: 'if (!(key in obj)) { throw new Error(); }',
        },

        // Complex object access
        {
            code: 'const result = Object.keys(state.config.settings).includes(settingName);',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'state.config.settings',
                    key: 'settingName',
                },
            }],
            output: 'const result = settingName in state.config.settings;',
        },

        // In conditional with other expressions
        {
            code: 'function test() { if (Object.keys(options).includes(choice) && isValid) { return true; } }',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'options',
                    key: 'choice',
                },
            }],
            output: 'function test() { if ((choice in options) && isValid) { return true; } }',
        },

        // With string literal key
        {
            code: 'function checkAdmin() { return Object.keys(permissions).includes("admin"); }',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'permissions',
                    key: '"admin"',
                },
            }],
            output: 'function checkAdmin() { return "admin" in permissions; }',
        },

        // In ternary operator
        {
            code: 'const hasKey = Object.keys(data).includes(keyName) ? "yes" : "no";',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'data',
                    key: 'keyName',
                },
            }],
            output: 'const hasKey = (keyName in data) ? "yes" : "no";',
        },

        // Function call as object
        {
            code: 'if (Object.keys(getConfig()).includes(param)) { proceed(); }',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'getConfig()',
                    key: 'param',
                },
            }],
            output: 'if (param in getConfig()) { proceed(); }',
        },

        // Array element as key
        {
            code: 'const found = Object.keys(lookup).includes(items[0]);',
            errors: [{
                messageId: 'noObjectKeysIncludes',
                data: {
                    object: 'lookup',
                    key: 'items[0]',
                },
            }],
            output: 'const found = items[0] in lookup;',
        },
    ],
});
