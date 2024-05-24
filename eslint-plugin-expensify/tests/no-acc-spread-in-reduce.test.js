const RuleTester = require('eslint').RuleTester;
const rule = require('../no-acc-spread-in-reduce');
const CONST = require('../CONST');

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
    },
});

const errors = [
    {
        message: CONST.MESSAGE.NO_ACC_SPREAD_IN_REDUCE,
    },
];

ruleTester.run('no-spread-in-reduce', rule, {
    valid: [
        {
            code: `
                array.reduce((acc, item) => {
                    acc[item.key] = item.value;
                    return acc;
                }
                , {});
            `,
        },
    ],
    invalid: [
        {
            code: `
          const arr = [];
          arr.reduce((acc, i) => ({ ...acc, i }), {})
        `,
            errors,
        },
        {
            code: `
        const arr = [];
        arr.reduceRight((acc, i) => ({ ...acc, i }), {})
      `,
            errors,
        },
        {
            code: `
          ([]).reduce((acc, i) => ({ ...acc, i }), {})
        `,
            errors,
        },
    ],
});
