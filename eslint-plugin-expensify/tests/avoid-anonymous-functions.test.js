const RuleTester = require('eslint').RuleTester;
const rule = require('../avoid-anonymous-functions');
const message = require('../CONST').MESSAGE.AVOID_ANONYMOUS_FUNCTIONS;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

ruleTester.run('avoid-anonymous-functions', rule, {
    valid: [
        {
            code: `
                function test() {
                    function innerFunction(node) {
                        return node.isParent;
                    }
                    
                    const onlyParents = nodes.filter(innerFunction);

                    return onlyParents;
                }`,
        },
        {
            code: `
                function test() {
                    const onlyParents = nodes.filter(function innerFunction(node) {
                        return node.isParent;
                    });

                    return onlyParents;
                }`,
        },
        {
            code: `
                function test() {
                    const node = {execute: function named() {}};
                    useEffect(function innerFunction() {
                        node.execute();
                    }, []);
                    return true;
                }`,
        },
        {
            code: `
                function test() {
                    const node = {execute: () => {}};
                    useEffect(function* () {
                        node.execute();
                    }, []);
                    return true;
                }`,
        },
        {
            code: `
                function test() {
                    const node = {execute: function named() {}};
                    useEffect(node.execute, []);
                    return true;
                }
            `
        },
        {
            code: `
                function test() {
                    const node = {execute: () => {}};
                    useEffect(node.execute, []);
                    return true;
                }
            `
        },
        {
            code: `
                function test() {
                    const node = () => {};
                    useEffect(node, []);
                    return true;
                }
            `
        },
        {
            code: `
                function test() {
                    const filteringById = () => {};
                    parents.filter(filteringById);
                    return true;
                }
            `
        },
        {
            code: `
                function test() {
                    function withName() {
                        return function innerName() {};
                    }
                    withName();
                    return true;
                }
            `
        },
    ],
    invalid: [
        {
            code: `
                function test() {
                    const onlyParents = nodes.filter((node) => node.isParent);

                    return onlyParents;
                }
            `,
            errors: [{
                message,
            }],
        },
        {
            code: `
                function test() {
                    const onlyParents = nodes.filter((node) => { 
                        return node.isParent;
                    });

                    return onlyParents;
                }
            `,
            errors: [{
                message,
            }],
        },
        {
            code: `
            function test() {
                const node = {execute: function named() {}};
                useEffect(function () {
                    node.execute();
                }, []);
                return true;
            }
            `,
            errors: [{
                message,
            }],
        },
        {
            code: `
            function test() {
                const node = {execute: function named() {}};
                useEffect(() => node.execute(), []);
                return true;
            }
            `,
            errors: [{
                message,
            }],
        },
        {
            code: `
            function test() {
                const node = {execute: () => {}};
                useEffect(function () {node.execute();} , []);
                return true;
            }
            `,
            errors: [{
                message,
            }],
        },
        {
            code: `
            function test() {
                function rightNamed() {
                    return () => {};
                }
                rightNamed();
                return true;
            }
            `,
            errors: [{
                message,
            }],
        },
        {
            code: `
            function test() {
                function rightNamed() {
                    return function () {};
                }
                rightNamed();
                return true;
            }
            `,
            errors: [{
                message,
            }],
        },
        {
            code: `
            function test() {
                const rightNamed = () => {
                    return function () {};
                }
                rightNamed();
                return true;
            }
            `,
            errors: [{
                message,
            }],
        },
        {
            code: `
            function test() {
                const rightNamed = () => {
                    return () => {};
                }
                rightNamed();
                return true;
            }
            `,
            errors: [{
                message,
            }],
        },
    ],
});
