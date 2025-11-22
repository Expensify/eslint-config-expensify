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
            code: `
                useEffect(() => {
                    console.log(transactionItem.isAmountColumnWide);
                }, [transactionItem.isAmountColumnWide]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(user.name, user.email);
                }, [user.name, user.email]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(Object.keys(user));
                    return JSON.stringify(user);
                }, [user]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log('mount only');
                }, []);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(user.name);
                    processUser(user);
                }, [user]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(obj.nested.value);
                }, [obj.nested.value]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    if (config.enabled) {
                        console.log(config.enabled);
                    }
                }, [config.enabled]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(person.firstName);
                    console.log(person.lastName);
                    console.log(person.age);
                }, [person.firstName, person.lastName, person.age]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    items.forEach(item => console.log(item.name));
                }, [items]);
            `,
        },
        {
            code: `
                function normalFunction() {
                    console.log(obj.property);
                }
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(user?.profile?.name);
                }, [user?.profile?.name]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    service.execute();
                }, [service]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(obj[dynamicKey]);
                }, [obj, dynamicKey]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    const copy = {...user};
                }, [user]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    const arr = [...items];
                }, [items]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    doSomething({...config});
                }, [config]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(someRef.current);
                }, [someRef]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(styles.container, style.padding);
                }, [styles, style]);
            `,
        },
        {
            code: `
                useEffect(() => {
                    console.log(theme.colors.primary);
                }, [theme]);
            `,
        },
        {
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
    ],
    invalid: [
        {
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

