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
        {
            code: 'const STUFF = [\'a\', \'b\', \'c\'] as const; type Good = TupleToUnion<typeof STUFF>;',
            parser: require.resolve('@typescript-eslint/parser'),
        },
        {
            code: 'const STUFF = [\'a\', \'b\', \'c\'] as const; type Good = Record<string, TupleToUnion<typeof TIMEZONES>>;',
            parser: require.resolve('@typescript-eslint/parser'),
        },
        {
            code: 'const CONST = { VIDEO_PLAYER: { PLAYBACK_SPEEDS: [0.25, 0.5, 1, 1.5, 2] } } as const; type Good = TupleToUnion<typeof CONST.VIDEO_PLAYER.PLAYBACK_SPEEDS>;',
            parser: require.resolve('@typescript-eslint/parser'),
        },
        {
            code: 'const COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Good = ValueOf<typeof COLORS>;',
            parser: require.resolve('@typescript-eslint/parser'),
        },
        {
            // eslint-disable-next-line max-len
            code: 'const CONST = { AVATAR_SIZE: { SMALL: \'small\', MEDIUM: \'medium\', LARGE: \'large\' } } as const; type Good = { avatarSize?: ValueOf<typeof CONST.AVATAR_SIZE>; }',
            parser: require.resolve('@typescript-eslint/parser'),
        },
    ],
    invalid: [
        {
            code: 'const STUFF = [\'a\', \'b\', \'c\'] as const; type Bad = (typeof STUFF)[number];',
            errors: [{message: PREFER_TYPE_FEST_TUPLE_TO_UNION}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {TupleToUnion} from \'type-fest\';\nconst STUFF = [\'a\', \'b\', \'c\'] as const; type Bad = TupleToUnion<typeof STUFF>;',
        },
        {
            code: 'const STUFF = [\'a\', \'b\', \'c\'] as const; type Bad = Record<string, (typeof STUFF)[number]>;',
            errors: [{message: PREFER_TYPE_FEST_TUPLE_TO_UNION}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {TupleToUnion} from \'type-fest\';\nconst STUFF = [\'a\', \'b\', \'c\'] as const; type Bad = Record<string, TupleToUnion<typeof STUFF>>;',
        },
        {
            code: 'const CONST = { VIDEO_PLAYER: { PLAYBACK_SPEEDS: [0.25, 0.5, 1, 1.5, 2] } } as const; type Bad = (typeof CONST.VIDEO_PLAYER.PLAYBACK_SPEEDS)[number];',
            errors: [{message: PREFER_TYPE_FEST_TUPLE_TO_UNION}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {TupleToUnion} from \'type-fest\';\nconst CONST = { VIDEO_PLAYER: { PLAYBACK_SPEEDS: [0.25, 0.5, 1, 1.5, 2] } } as const; type Bad = TupleToUnion<typeof CONST.VIDEO_PLAYER.PLAYBACK_SPEEDS>;',
        },
        {
            code: 'const TIMEZONES = [\'a\', \'b\'] as const; const test: Record<string, (typeof TIMEZONES)[number]> = { a: \'a\', b: \'b\' };',
            errors: [{message: PREFER_TYPE_FEST_TUPLE_TO_UNION}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {TupleToUnion} from \'type-fest\';\nconst TIMEZONES = [\'a\', \'b\'] as const; const test: Record<string, TupleToUnion<typeof TIMEZONES>> = { a: \'a\', b: \'b\' };',
        },
        {
            code: 'import type {Something} from \'type-fest\';\nconst TIMEZONES = [\'a\', \'b\'] as const; const test: Record<string, (typeof TIMEZONES)[number]> = { a: \'a\', b: \'b\' };',
            errors: [{message: PREFER_TYPE_FEST_TUPLE_TO_UNION}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {Something, TupleToUnion} from \'type-fest\';\nconst TIMEZONES = [\'a\', \'b\'] as const; const test: Record<string, TupleToUnion<typeof TIMEZONES>> = { a: \'a\', b: \'b\' };',
        },
        {
            code: 'const COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = (typeof COLORS)[keyof COLORS];',
            errors: [{message: PREFER_TYPE_FEST_VALUE_OF}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {ValueOf} from \'type-fest\';\nconst COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = ValueOf<typeof COLORS>;',
        },
        {
            // eslint-disable-next-line max-len
            code: 'const CONST = { AVATAR_SIZE: { SMALL: \'small\', MEDIUM: \'medium\', LARGE: \'large\' } } as const; type Bad = { avatarSize?: (typeof CONST.AVATAR_SIZE)[keyof typeof CONST.AVATAR_SIZE]; }',
            errors: [{message: PREFER_TYPE_FEST_VALUE_OF}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {ValueOf} from \'type-fest\';\nconst CONST = { AVATAR_SIZE: { SMALL: \'small\', MEDIUM: \'medium\', LARGE: \'large\' } } as const; type Bad = { avatarSize?: ValueOf<typeof CONST.AVATAR_SIZE>; }',
        },
        {
            code: 'import type {ValueOf} from \'type-fest\';\nconst COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = (typeof COLORS)[keyof COLORS];',
            errors: [{message: PREFER_TYPE_FEST_VALUE_OF}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {ValueOf} from \'type-fest\';\nconst COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = ValueOf<typeof COLORS>;',
        },
        {
            code: 'import type {TupleToUnion} from \'type-fest\';\nconst COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = (typeof COLORS)[keyof COLORS];',
            errors: [{message: PREFER_TYPE_FEST_VALUE_OF}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {TupleToUnion, ValueOf} from \'type-fest\';\nconst COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = ValueOf<typeof COLORS>;',
        },
        {
            code: 'import somethingElse from \'something-else\';\nconst COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = (typeof COLORS)[keyof COLORS];',
            errors: [{message: PREFER_TYPE_FEST_VALUE_OF}],
            parser: require.resolve('@typescript-eslint/parser'),
            output: 'import type {ValueOf} from \'type-fest\';\nimport somethingElse from \'something-else\';\nconst COLORS = { GREEN: \'green\', BLUE: \'blue\' } as const; type Bad = ValueOf<typeof COLORS>;',
        },
    ],
});
