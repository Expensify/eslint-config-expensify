import {RuleTester} from 'eslint';
import * as rule from '../no-deep-equal-in-memo.js';

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
        },
    },
});

ruleTester.run('no-deep-equal-in-memo', rule, {
    valid: [
        {
            // React.memo without comparison function
            code: `
                const MyComponent = React.memo((props) => {
                    return <div>{props.name}</div>;
                });
            `,
        },
        {
            // React.memo with shallow property comparisons
            code: `
                const MyComponent = React.memo(
                    (props) => <div>{props.name}</div>,
                    (prevProps, nextProps) =>
                        prevProps.report.type === nextProps.report.type &&
                        prevProps.report.reportID === nextProps.report.reportID &&
                        prevProps.isSelected === nextProps.isSelected
                );
            `,
        },
        {
            // React.memo with other comparison logic (no deep equality)
            code: `
                const MyComponent = React.memo(
                    (props) => <div>{props.name}</div>,
                    (prevProps, nextProps) => {
                        return prevProps.id === nextProps.id;
                    }
                );
            `,
        },
        {
            // memo (named import) with valid comparisons
            code: `
                const MyComponent = memo(
                    (props) => <div>{props.name}</div>,
                    (prevProps, nextProps) =>
                        prevProps.name === nextProps.name &&
                        prevProps.email === nextProps.email
                );
            `,
        },
        {
            // Regular function with deep equality (not in memo)
            code: `
                function compareObjects(a, b) {
                    return deepEqual(a, b);
                }
            `,
        },
        {
            // Regular function with _.isEqual (not in memo)
            code: `
                function compareObjects(a, b) {
                    return _.isEqual(a, b);
                }
            `,
        },
        {
            // React.memo with complex comparison but no deep equality
            code: `
                const MyComponent = React.memo(
                    (props) => <div>{props.name}</div>,
                    (prevProps, nextProps) => {
                        if (prevProps.items.length !== nextProps.items.length) {
                            return false;
                        }
                        return prevProps.id === nextProps.id;
                    }
                );
            `,
        },
        {
            // memo with arrow function using implicit return
            code: `
                const MyComponent = memo(
                    Component,
                    (prev, next) => prev.value === next.value
                );
            `,
        },
    ],
    invalid: [
        {
            // React.memo with deepEqual
            code: `
                const MyComponent = React.memo(
                    (props) => <div>{props.name}</div>,
                    (prevProps, nextProps) =>
                        deepEqual(prevProps.report, nextProps.report) &&
                        prevProps.isSelected === nextProps.isSelected
                );
            `,
            errors: [{
                messageId: 'noDeepEqualInMemo',
                data: {
                    functionName: 'deepEqual',
                },
            }],
        },
        {
            // React.memo with isEqual
            code: `
                const MyComponent = React.memo(
                    (props) => <div>{props.name}</div>,
                    (prevProps, nextProps) =>
                        isEqual(prevProps.report, nextProps.report) &&
                        prevProps.isSelected === nextProps.isSelected
                );
            `,
            errors: [{
                messageId: 'noDeepEqualInMemo',
                data: {
                    functionName: 'isEqual',
                },
            }],
        },
        {
            // React.memo with _.isEqual
            code: `
                const MyComponent = React.memo(
                    (props) => <div>{props.name}</div>,
                    (prevProps, nextProps) =>
                        _.isEqual(prevProps.report, nextProps.report) &&
                        prevProps.isSelected === nextProps.isSelected
                );
            `,
            errors: [{
                messageId: 'noDeepEqualInMemo',
                data: {
                    functionName: '_.isEqual',
                },
            }],
        },
        {
            // memo (named import) with deepEqual
            code: `
                const MyComponent = memo(
                    Component,
                    (prevProps, nextProps) => deepEqual(prevProps, nextProps)
                );
            `,
            errors: [{
                messageId: 'noDeepEqualInMemo',
                data: {
                    functionName: 'deepEqual',
                },
            }],
        },
        {
            // memo with isEqual in block body
            code: `
                const MyComponent = memo(
                    Component,
                    (prevProps, nextProps) => {
                        return isEqual(prevProps.data, nextProps.data);
                    }
                );
            `,
            errors: [{
                messageId: 'noDeepEqualInMemo',
                data: {
                    functionName: 'isEqual',
                },
            }],
        },
        {
            // Multiple deep comparison calls in one comparison function
            code: `
                const MyComponent = React.memo(
                    Component,
                    (prevProps, nextProps) =>
                        deepEqual(prevProps.a, nextProps.a) &&
                        isEqual(prevProps.b, nextProps.b)
                );
            `,
            errors: [
                {
                    messageId: 'noDeepEqualInMemo',
                    data: {
                        functionName: 'deepEqual',
                    },
                },
                {
                    messageId: 'noDeepEqualInMemo',
                    data: {
                        functionName: 'isEqual',
                    },
                },
            ],
        },
        {
            // _.isEqual nested in conditional
            code: `
                const MyComponent = React.memo(
                    Component,
                    (prevProps, nextProps) => {
                        if (prevProps.id === nextProps.id) {
                            return _.isEqual(prevProps.data, nextProps.data);
                        }
                        return false;
                    }
                );
            `,
            errors: [{
                messageId: 'noDeepEqualInMemo',
                data: {
                    functionName: '_.isEqual',
                },
            }],
        },
        {
            // deepEqual used in logical expression
            code: `
                const MyComponent = memo(
                    Component,
                    (prev, next) => {
                        const dataEqual = deepEqual(prev.data, next.data);
                        return dataEqual && prev.id === next.id;
                    }
                );
            `,
            errors: [{
                messageId: 'noDeepEqualInMemo',
                data: {
                    functionName: 'deepEqual',
                },
            }],
        },
    ],
});

