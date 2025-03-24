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
        {
            code: `const searchCategories = categoriesForSearch.filter((category) => {return category.name.toLowerCase().includes(searchValue.toLowerCase());});`,
            errors: [{
                message: message,
            }],
        },
        {
            code: `const filteredOptions = membersDetails.filter((option) => {return !!option.text?.toLowerCase().includes(searchValue) || !!option.alternateText?.toLowerCase().includes(searchValue);});`,
            errors: [{
                message: message,
            }],
        },
        {
            code: `const filtered = exportMenuItem?.data.filter((option) => {return option.value.toLowerCase().includes(searchText);});`,
            errors: [{
                message: message,
            }],
        },
        {
            code: `const filtered = array.filter(({ searchText }) => {return searchText.toLowerCase().includes(searchValue.toLowerCase());});`,
            errors: [{
                message: message,
            }],
        },
        {
            code: `
                const filteredApprovers = debouncedSearchTerm !== ''
                    ? approvers.filter((option) => {
                        const searchValue = getSearchValueForPhoneOrEmail(debouncedSearchTerm);
                        const isPartOfSearchTerm = !!option.text?.toLowerCase().includes(searchValue) || !!option.login?.toLowerCase().includes(searchValue);
                        return isPartOfSearchTerm;
                    })
                    : approvers;
            `,
            errors: [{
                message: message,
            }],
        },
        {
            code: `
                const enabledSearchTags = enabledTagsWithoutSelectedOptions.filter((tag) => {
                    return PolicyUtils.getCleanedTagName(tag.name.toLowerCase()).includes(searchValue.toLowerCase());
                });
            `,
            errors: [{ message }],
        },
        {
            code: `
                const filteredOptions = [...formattedPolicyAdmins, ...formattedAuthorizedPayer].filter((option) => {
                    const searchValue = OptionsListUtils.getSearchValueForPhoneOrEmail(searchTerm);
                    return !!option.text?.toLowerCase().includes(searchValue) || !!option.login?.toLowerCase().includes(searchValue);
                });
            `,
            errors: [{ message }],
        },
    ],
});
