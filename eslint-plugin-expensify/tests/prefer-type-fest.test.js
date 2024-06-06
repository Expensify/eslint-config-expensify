const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-type-fest');
const {PREFER_TYPE_FEST_VALUE_OF, PREFER_TYPE_FEST_TUPLE_TO_UNION} = require('../CONST').MESSAGE;

const ruleTester = new RuleTester({
    parser: require.resolve('@typescript-eslint/parser'),
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
    },
});

ruleTester.run('prefer-type-fest', rule, {
    valid: [
        // {
        //     code: 'const STUFF = [\'a\', \'b\', \'c\'] as const; type Good = TupleToUnion<typeof STUFF>;',
        //     parser: require.resolve('@typescript-eslint/parser'),
        // },
        {
            code: 'const COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Good = ValueOf<typeof COLORS>;',
            parser: require.resolve('@typescript-eslint/parser'),
        },
    ],
    invalid: [
        // {
        //     code: 'const STUFF = [\'a\', \'b\', \'c\'] as const; type Bad = (typeof STUFF)[number];',
        //     errors: [{message: PREFER_TYPE_FEST_TUPLE_TO_UNION}],
        //     parser: require.resolve('@typescript-eslint/parser'),
        // },
        {
            code: 'const COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = (typeof COLORS)[keyof COLORS];',
            errors: [{message: PREFER_TYPE_FEST_VALUE_OF}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'const COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = ValueOf<typeof COLORS>;',
        },
    ],
});
