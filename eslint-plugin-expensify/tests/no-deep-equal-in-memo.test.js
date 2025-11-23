import {RuleTester} from '@typescript-eslint/rule-tester';
import parser from '@typescript-eslint/parser';
import * as rule from '../no-deep-equal-in-memo.js';

const ruleTester = new RuleTester({
    languageOptions: {
        parser,
        parserOptions: {
            sourceType: 'module',
            ecmaVersion: 2020,
            ecmaFeatures: {
                jsx: true,
            },
        },
    },
});

ruleTester.run('no-deep-equal-in-memo', rule, {
    valid: [
        {
            name: 'React.memo with shallow property comparisons',
            code: `
                import React, { memo } from 'react';
                const ReportActionItem = memo(Component, (prevProps, nextProps) =>
                    prevProps.report.type === nextProps.report.type &&
                    prevProps.report.reportID === nextProps.report.reportID &&
                    prevProps.isSelected === nextProps.isSelected
                );
            `,
        },
        {
            name: 'React.memo without custom comparison function',
            code: `
                import React, { memo } from 'react';
                const MyComponent = memo(Component);
            `,
        },
        {
            name: 'memo with Object.is comparison',
            code: `
                import { memo } from 'react';
                const MyComponent = memo(Component, (prevProps, nextProps) =>
                    Object.is(prevProps.id, nextProps.id)
                );
            `,
        },
        {
            name: 'Regular function with deepEqual (not in memo)',
            code: `
                import { deepEqual } from 'lodash';
                function compareObjects(a, b) {
                    return deepEqual(a, b);
                }
            `,
        },
        {
            name: 'useMemo with deepEqual (not a memo comparison)',
            code: `
                import { useMemo } from 'react';
                import { deepEqual } from 'lodash';
                const value = useMemo(() => deepEqual(obj1, obj2), [obj1, obj2]);
            `,
        },
    ],
    invalid: [
        {
            name: 'React.memo with lodash deepEqual',
            code: `
                import React, { memo } from 'react';
                import { deepEqual } from 'lodash';
                const ReportActionItem = memo(Component, (prevProps, nextProps) =>
                    deepEqual(prevProps.report, nextProps.report) &&
                    prevProps.isSelected === nextProps.isSelected
                );
            `,
            errors: [
                {
                    messageId: 'noDeepEqualInMemo',
                    line: 5,
                },
            ],
        },
        {
            name: 'React.memo with underscore isEqual',
            code: `
                import React from 'react';
                import { isEqual } from 'underscore';
                const MyComponent = React.memo(Component, (prevProps, nextProps) =>
                    isEqual(prevProps.data, nextProps.data)
                );
            `,
            errors: [
                {
                    messageId: 'noDeepEqualInMemo',
                    line: 5,
                },
            ],
        },
        {
            name: 'memo with lodash isEqual',
            code: `
                import { memo } from 'react';
                import { isEqual } from 'lodash';
                const MyComponent = memo(Component, (prevProps, nextProps) =>
                    isEqual(prevProps, nextProps)
                );
            `,
            errors: [
                {
                    messageId: 'noDeepEqualInMemo',
                    line: 5,
                },
            ],
        },
        {
            name: 'memo with deepEqual and shallow comparisons mixed',
            code: `
                import { memo } from 'react';
                import { deepEqual } from 'lodash';
                const MyComponent = memo(Component, (prevProps, nextProps) =>
                    prevProps.id === nextProps.id &&
                    deepEqual(prevProps.config, nextProps.config)
                );
            `,
            errors: [
                {
                    messageId: 'noDeepEqualInMemo',
                    line: 6,
                },
            ],
        },
        {
            name: 'memo with JSON.stringify comparison',
            code: `
                import { memo } from 'react';
                const MyComponent = memo(Component, (prevProps, nextProps) =>
                    JSON.stringify(prevProps) === JSON.stringify(nextProps)
                );
            `,
            errors: [
                {
                    messageId: 'noDeepEqualInMemo',
                    line: 4,
                },
            ],
        },
    ],
});
