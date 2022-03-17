const RuleTester = require('eslint').RuleTester;
const rule = require('../prefer-constructors-with-props');
const message = require('../CONST').MESSAGE.PREFER_REACT_CLASS_CONSTRUCTORS_WITH_PROPS;

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module',
    },
});

const goodExample = `
class Car extends React.Component {
    constructor(props) {
        super(props);
    }
}
`;

const goodExample2 = `
class Random {
    constructor() {
    }
}
`;

const goodExample3 = `
class Car extends Component {
    constructor(props) {
        super(props);
    }
}
`;

const goodExample4 = `
class Lambo extends Car {
    constructor(props) {
        super(props);
    }
}
`;

const badExample = `
class Car extends React.Component {
    constructor() {
    }
}
`;

const badExample2 = `
class Car extends React.Component {
    constructor(props) {
    }
}
`;

ruleTester.run('prefer-constructors-with-props', rule, {
    valid: [
        {
            code: goodExample,
        },
        {
            code: goodExample2,
        },
        {
            code: goodExample3,
        },
        {
            code: goodExample4,
        },
    ],
    invalid: [
        {
            code: badExample,
            errors: [{
                message,
            }],
        },
        {
            code: badExample2,
            errors: [{
                message,
            }],
        },
    ],
});
