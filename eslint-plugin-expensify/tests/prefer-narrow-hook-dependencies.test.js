import {RuleTester} from 'eslint';
import * as rule from '../prefer-narrow-hook-dependencies.js';

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

ruleTester.run('prefer-narrow-hook-dependencies', rule, {
    valid: [
        {
            // Already narrowed - dependency matches the property being accessed
            code: `
                useEffect(() => {
                    console.log(transactionItem.isAmountColumnWide);
                }, [transactionItem.isAmountColumnWide]);
            `,
        },
        {
            // Already narrowed - dependencies match the specific properties being accessed
            code: `
                useEffect(() => {
                    console.log(user.name, user.email);
                }, [user.name, user.email]);
            `,
        },
        {
            // Object used as whole
            code: `
                useEffect(() => {
                    console.log(Object.keys(user));
                    return JSON.stringify(user);
                }, [user]);
            `,
        },
        {
            // Empty dependency array
            code: `
                useEffect(() => {
                    console.log('mount only');
                }, []);
            `,
        },
        {
            // Object used as whole + property used
            code: `
                useEffect(() => {
                    console.log(user.name);
                    processUser(user);
                }, [user]);
            `,
        },
        {
            // Already narrowed - deeply nested property
            code: `
                useEffect(() => {
                    console.log(obj.nested.value);
                }, [obj.nested.value]);
            `,
        },
        {
            // Already narrowed - multiple properties
            code: `
                useEffect(() => {
                    console.log(person.firstName);
                    console.log(person.lastName);
                    console.log(person.age);
                }, [person.firstName, person.lastName, person.age]);
            `,
        },
        {
            // Not a React hook
            code: `
                function normalFunction() {
                    console.log(obj.property);
                }
            `,
        },
        {
            // Already narrowed - optional chaining property correctly specified
            code: `
                useEffect(() => {
                    console.log(user?.profile?.name);
                }, [user?.profile?.name]);
            `,
        },
        {
            // Method call - .execute() requires the whole service object
            code: `
                useEffect(() => {
                    service.execute();
                }, [service]);
            `,
        },
        {
            // Computed property access - obj[dynamicKey] requires whole object
            code: `
                useEffect(() => {
                    console.log(obj[dynamicKey]);
                }, [obj, dynamicKey]);
            `,
        },
        {
            // Spread - {...user} requires the whole object
            code: `
                useEffect(() => {
                    const copy = {...user};
                    const copyItems = [...items];
                }, [user, items]);
            `,
        },
        {
            // Ref with .current access
            code: `
                useEffect(() => {
                    console.log(someRef.current);
                }, [someRef]);
            `,
        },
        {
            // Stable object patterns - 'styles' and 'style' are treated as stable
            code: `
                useEffect(() => {
                    console.log(styles.container, style.padding);
                }, [styles, style]);
            `,
        },
        {
            // Stable object pattern - 'theme' is treated as stable
            code: `
                useEffect(() => {
                    console.log(theme.colors.primary);
                }, [theme]);
            `,
        },
        {
            // JSX with array methods and props - items.at() method call + passed to component
            code: `
                useMemo(() => {
                    return items.length === 1 ? (
                        <Button onPress={items.at(0)?.onPress} />
                    ) : (
                        <Menu menuItems={items} />
                    );
                }, [items]);
            `,
        },
        {
            // Object passed to function in variable declaration - whole object needed
            code: `
                useCallback(() => {
                    const threadReport = createThreadReport(report, action);
                    if (threadReport) {
                        doSomething(threadReport.reportID);
                    } else {
                        doSomethingElse(report?.reportID, report?.policyID);
                    }
                }, [report, action]);
            `,
        },
        {
            // Collection converted to array - Array.from() requires whole collection
            code: `
                useCallback(() => {
                    if (activeTooltips.size === 0) {
                        return null;
                    }
                    const sortedTooltips = Array.from(activeTooltips)
                        .map((name) => ({
                            name,
                            priority: TOOLTIPS[name]?.priority ?? 0,
                        }))
                        .sort((a, b) => b.priority - a.priority);
                    return sortedTooltips.at(0);
                }, [activeTooltips]);
            `,
        },
    ],
    invalid: [
        {
            // Should narrow - only accessing nested property with optional chaining
            code: `
                useEffect(() => {
                    console.log(user?.profile?.name);
                }, [user]);
            `,
            output: `
                useEffect(() => {
                    console.log(user?.profile?.name);
                }, [user?.profile?.name]);
            `,
            errors: [{
                messageId: 'narrowDependency',
                data: {
                    dependency: 'user',
                    properties: 'user?.profile?.name',
                },
            }],
        },
        {
            // Should narrow - only accessing a single property
            code: `
                useEffect(() => {
                    console.log(transactionItem.isAmountColumnWide);
                }, [transactionItem]);
            `,
            output: `
                useEffect(() => {
                    console.log(transactionItem.isAmountColumnWide);
                }, [transactionItem.isAmountColumnWide]);
            `,
            errors: [{
                messageId: 'narrowDependency',
                data: {
                    dependency: 'transactionItem',
                    properties: 'transactionItem.isAmountColumnWide',
                },
            }],
        },
        {
            // Should narrow - accessing multiple specific properties
            code: `
                useEffect(() => {
                    console.log(user.name);
                    console.log(user.email);
                }, [user]);
            `,
            output: `
                useEffect(() => {
                    console.log(user.name);
                    console.log(user.email);
                }, [user.name, user.email]);
            `,
            errors: [{
                messageId: 'narrowDependency',
                data: {
                    dependency: 'user',
                    properties: 'user.name, user.email',
                },
            }],
        },
        {
            // Should narrow - accessing deeply nested property
            code: `
                useEffect(() => {
                    console.log(data.profile.name);
                }, [data]);
            `,
            output: `
                useEffect(() => {
                    console.log(data.profile.name);
                }, [data.profile.name]);
            `,
            errors: [{
                messageId: 'narrowDependency',
                data: {
                    dependency: 'data',
                    properties: 'data.profile.name',
                },
            }],
        },
        {
            // Should narrow - one dependency already narrowed, one needs narrowing
            code: `
                useEffect(() => {
                    console.log(a.x, b.y);
                }, [a.x, b]);
            `,
            output: `
                useEffect(() => {
                    console.log(a.x, b.y);
                }, [a.x, b.y]);
            `,
            errors: [{
                messageId: 'narrowDependency',
                data: {
                    dependency: 'b',
                    properties: 'b.y',
                },
            }],
        },
    ],
});

