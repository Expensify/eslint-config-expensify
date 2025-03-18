const { RuleTester } = require('eslint');
const rule = require('../prefer-tokenized-search');
const message = require('../CONST').MESSAGE.PREFER_TOKENIZED_SEARCH;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
});

ruleTester.run('prefer-tokenized-search', rule, {
    valid: [
        {
            code: `const result = tokenizedSearch(items, searchValue, (item) => [item.name ?? '']);`,
        },
        {
            code: `const filtered = items.filter((item) => item.active);`,
        },
        {
            code: `const found = array.some((val) => val === searchValue);`,
        },
    ],
    invalid: [
        {
            code: `const filtered = items.filter((item) => item.name.toLowerCase().includes(searchValue.toLowerCase()));`,
            errors: [{
                message: message,
            }],
        },
        {
            code: `const searchResults = data.filter(entry => entry.title.toLowerCase().includes(query.toLowerCase()));`,
            errors: [{
                message: message,
            }],
        },
        {
            code: `const enabledSearchTaxRates = enabledTaxRatesWithoutSelectedOptions.filter((taxRate) => taxRate.modifiedName?.toLowerCase().includes(searchValue.toLowerCase()));`,
            errors: [{
                message: message,
            }],
        },
    ],
});
