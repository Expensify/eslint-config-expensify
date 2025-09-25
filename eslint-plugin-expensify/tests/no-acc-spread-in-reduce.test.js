import {RuleTester} from 'eslint';
import * as rule from '../no-acc-spread-in-reduce.js';
import CONST from '../CONST.js';

const ruleTester = new RuleTester({
    languageOptions: {
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
        {
            code: `
                array.reduce((acc, item) => {
                    const spread = { ...somethingElse };
                    return acc[item.key] = item.value;
                }, {});
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
