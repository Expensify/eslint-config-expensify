import {RuleTester} from 'eslint';
import * as rule from '../no-default-props.js';
import CONST from '../CONST.js';

const message = CONST.MESSAGE.NO_DEFAULT_PROPS;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        parserOptions: {
            ecmaFeatures: {
                // To support use of < in HOC
                jsx: true,

                // To support use of ... operator
                experimentalObjectRestSpread: true,
            },
        },
    },
});

ruleTester.run('no-default-props', rule, {
    valid: [
        {
            code: `
                function Test({ propWithDefault = 'defaultValue' }) {
                   return <div>{propWithDefault}</div>;
                }`,
            filename: '/src/components/Test.js',
        },
        {
            code: `
            function Test({ propWithDefault = 'defaultValue' }) {
                return <div>{propWithDefault}</div>;
            }
            Test.displayName = 'Test';`,
            filename: '/src/components/Test.js',
        },
        {
            // VALID AS TECHNICALLY THIS IS NOT A FUNCTION DECLARATION
            code: `
            const Test = React.forwardRef((props, ref) => {
                return <div>{props.propWithDefault}</div>;
            });
            Test.defaultProps = { propWithDefault: 'defaultValue' };`,
            filename: '/src/pages/Test.js',
        },
        {
            // VALID AS TECHNICALLY THIS IS NOT A FUNCTION DECLARATION
            code: `
            const Test = React.memo((props) => {
                return <div>{props.propWithDefault}</div>;
            });
            Test.defaultProps = { propWithDefault: 'defaultValue' };`,
            filename: '/src/pages/Test.js',
        },
        {
            code: `
            class Test extends React.Component {
                constructor(props) {
                    super(props);
                }
                render() {
                   return <div>{this.props.propWithDefault}</div>;
                }
            }
            Test.defaultProps = { propWithDefault: 'defaultValue' };`,
            filename: '/src/pages/Test.js',
        },
        {
            code: `function Test(props) {
                return <div>{props.propWithDefault}</div>;
            }
            Test.displayName = 'Test';
            Test.defaultProps = { propWithDefault: 'defaultValue' };`,
            filename: '/src/libs/Test.js',
        },
    ],
    invalid: [
        {
            code: `
            function Test({ propWithDefault = 'defaultValue' }) {
                return <div>{props.propWithDefault}</div>;
            }
            Test.defaultProps = { propWithDefault: 'defaultValue' };`,
            filename: '/src/components/Test.js',
            errors: [{message}],
        },
        {
            code: `
            function Test(props) {
                return <div>{props.propWithDefault}</div>;
            }
            Test.displayName = 'Test';
            Test.defaultProps = { propWithDefault: 'defaultValue' };`,
            filename: '/src/pages/Test.js',
            errors: [{message}],
        },
        {
            code: `function Test(props, ref) {
                return <div>{props.propWithDefault}</div>;
            }
            Test.defaultProps = { propWithDefault: 'defaultValue' };
            export default React.forwardRef(Test);`,
            filename: '/src/pages/Test.js',
            errors: [{message}],
        },
        {
            code: `function Test(props) {
                return <div>{props.propWithDefault}</div>;
            }
            Test.defaultProps = { propWithDefault: 'defaultValue' };
            export default React.memo(Test);`,
            filename: '/src/pages/Test.js',
            errors: [{message}],
        },
        {
            code: `
            function HOC(Component) {
                function WrappedComponent({propWithDefault, ...props}) {
                    return <Component {...props} />;
                }
                WrappedComponent.defaultProps = { propWithDefault: 'defaultValue' };
                return WrappedComponent;
            }`,
            filename: '/src/pages/Test.js',
            errors: [{message}],
        },
        {
            code: `
            function HOC(Component) {
                function WrappedComponent({propWithDefault, ...props}) {
                    return <Component {...props} />;
                }
                WrappedComponent.defaultProps = { propWithDefault: 'defaultValue' };
                return WrappedComponent;
            }
            function Test(props) {
                return <div>{props.propWithDefault}</div>;
            }
            Test.defaultProps = { propWithDefault: 'defaultValue' };
            export default HOC(Test);`,
            filename: '/src/pages/Test.js',
            errors: [{message}, {message}],
        },
        {
            code: `
             export function  Test(props) {
                return <div>{props.propWithDefault}</div>;
             }
            Test.defaultProps = { propWithDefault: 'defaultValue' };`,
            filename: '/src/pages/Test.js',
            errors: [{message}],
        },
    ],
});
