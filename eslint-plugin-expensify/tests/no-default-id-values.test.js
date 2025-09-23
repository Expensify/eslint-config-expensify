const RuleTester = require('eslint').RuleTester;
const rule = require('../no-default-id-values');

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
});

ruleTester.run('no-default-id-values', rule, {
    valid: [
        // Number IDs
        {
            code: 'const accountID = report?.ownerAccountID ?? CONST.DEFAULT_NUMBER_ID;',
        },
        {
            code: 'const accountID = account?.id ?? CONST.DEFAULT_NUMBER_ID;',
        },
        {
            code: 'currentState = currentState?.routes[currentState.index ?? -1].state;',
        },
        {
            code: 'currentState = currentState?.routes[currentState.index ?? 0].state;',
        },
        {
            code: 'const accountID = report?.ownerAccountID || CONST.DEFAULT_NUMBER_ID;',
        },
        {
            code: 'const accountID = account?.id || CONST.DEFAULT_NUMBER_ID;',
        },
        {
            code: 'currentState = currentState?.routes[currentState.index || -1].state;',
        },
        {
            code: 'currentState = currentState?.routes[currentState.index || 0].state;',
        },
        {
            code: 'const managerID = report ? report.managerID : CONST.DEFAULT_NUMBER_ID;',
        },
        {
            code: 'const accountID = account ? account.id : CONST.DEFAULT_NUMBER_ID;',
        },
        {
            code: 'options.sort((method) => (method.value === exportMethod ? -1 : 0));',
        },

        // String IDs
        {
            code: 'const reportID = report?.reportID;',
        },
        {
            code: 'const iconName = icon.name ?? \'\'',
        },
        {
            code: 'const index = tempIndex ?? \'0\'',
        },
        {
            code: 'const iconName = icon.name || \'\'',
        },
        {
            code: 'const index = tempIndex || \'0\'',
        },
    ],
    invalid: [
        // Number IDs
        {
            code: 'const accountID = report?.ownerAccountID ?? -1;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const reportID = report?.id ?? -1;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const accountID = report?.ownerAccountID ?? 0;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const reportID = report?.id ?? 0;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const accountID = report?.ownerAccountID || -1;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const reportID = report?.id || -1;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const accountID = report?.ownerAccountID || 0;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const reportID = report?.id || 0;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const managerID = report ? report.managerID : -1;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const accountID = account ? account.id : -1;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const managerID = report ? report.managerID : 0;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },
        {
            code: 'const accountID = account ? account.id : 0;',
            errors: [{
                messageId: 'disallowedNumberDefault',
            }],
        },

        // String IDs
        {
            code: 'const reportID = report?.reportID ?? \'-1\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const currentReportID = Navigation.getTopmostReportId() ?? \'-1\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const currentReportID = navigationRef?.isReady?.() ? Navigation.getTopmostReportId() ?? \'-1\' : \'-1\';',
            errors: [
                {
                    messageId: 'disallowedStringDefault',
                },
                {
                    messageId: 'disallowedStringDefault',
                },
            ],
        },
        {
            code: 'const policyID = policy?.id ?? \'-1\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const reportID = report?.reportID ?? \'\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const policyID = policy?.id ?? \'\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const reportID = report?.reportID ?? \'0\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const policyID = policy?.id ?? \'0\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const reportID = report?.reportID || \'-1\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const currentReportID = Navigation.getTopmostReportId() || \'-1\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const currentReportID = navigationRef?.isReady?.() ? Navigation.getTopmostReportId() || \'-1\' : \'-1\';',
            errors: [
                {
                    messageId: 'disallowedStringDefault',
                },
                {
                    messageId: 'disallowedStringDefault',
                },
            ],
        },
        {
            code: 'const reportID = report?.reportID || \'\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const policyID = policy?.id || \'\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const reportID = report?.reportID || \'0\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const policyID = policy?.id || \'0\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const reportID = report ? report.reportID : \'-1\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            code: 'const reportID = report ? report.reportID : \'0\';',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            // eslint-disable-next-line no-template-curly-in-string
            code: 'const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${transaction?.reportID ?? CONST.DEFAULT_NUMBER_ID}`);',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            // eslint-disable-next-line no-template-curly-in-string
            code: 'useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${report.parentReportID || CONST.DEFAULT_NUMBER_ID}`);',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            // eslint-disable-next-line no-template-curly-in-string
            code: 'const policyID = policy ? policy.id : `${CONST.DEFAULT_NUMBER_ID}`;',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
        {
            // eslint-disable-next-line no-template-curly-in-string
            code: 'const policyID = policy?.id ?? `${CONST.DEFAULT_NUMBER_ID}`;',
            errors: [{
                messageId: 'disallowedStringDefault',
            }],
        },
    ],
});
