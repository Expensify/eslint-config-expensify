const RuleTester = require('eslint').RuleTester;
const rule = require('../no-beta-handler');

const ruleTester = new RuleTester({
    parser: require.resolve('@typescript-eslint/parser'),
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
    },
});

ruleTester.run('no-beta-handler', rule, {
    valid: [
        {
            code: `
                function isBetaEnabled(beta, betas) {
                    // This beta has been released to everyone, but in case user does not have the NVP loaded, we need to return true here.
                    // Will be removed in this issue https://github.com/Expensify/App/issues/63254
                    if (beta === 'table-view') {
                        return true;
                    }
                    return !!betas?.includes(beta) || canUseAllBetas(betas);
                }
            `,
        },
    ],
    invalid: [
        {
            code: `
                function isBlockedFromSpotnanaTravel(betas) {
                    // Don't check for all betas or nobody can use test travel on dev
                    return !!betas?.includes('table-view');
                }
            `,
            errors: [{
                message: "Avoid creating custom beta checker functions (e.g., 'isBlockedFromSpotnanaTravel'). Use `isBetaEnabled` utility method instead for checking beta features.",
            }],
        },
    ],
});
