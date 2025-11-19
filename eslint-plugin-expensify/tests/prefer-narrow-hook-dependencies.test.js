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
                    if (settings.enabled) {
                        console.log(settings.enabled);
                        return settings.enabled;
                    }
                }, [settings]);
            `,
            output: `
                useEffect(() => {
                    if (settings.enabled) {
                        console.log(settings.enabled);
                        return settings.enabled;
                    }
                }, [settings.enabled]);
            `,
            errors: [{
                messageId: 'narrowDependency',
                data: {
                    dependency: 'settings',
                    properties: 'settings.enabled',
                },
            }],
        },
        {
            code: `
                useEffect(() => {
                    console.log(user?.name);
                }, [user]);
            `,
            output: `
                useEffect(() => {
                    console.log(user?.name);
                }, [user?.name]);
            `,
            errors: [{
                messageId: 'narrowDependency',
                data: {
                    dependency: 'user',
                    properties: 'user?.name',
                },
            }],
        },
        {
            code: `
                useEffect(() => {
                    console.log(app.config.settings.theme.color);
                }, [app]);
            `,
            output: `
                useEffect(() => {
                    console.log(app.config.settings.theme.color);
                }, [app.config.settings.theme.color]);
            `,
            errors: [{
                messageId: 'narrowDependency',
                data: {
                    dependency: 'app',
                    properties: 'app.config.settings.theme.color',
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

