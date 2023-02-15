const RuleTester = require('eslint').RuleTester;
const rule = require('../onyx-props-must-have-default');

const {
    PROP_TYPE_REQUIRED_FALSE, PROP_TYPE_NOT_DECLARED, PROP_DEEFAULT_NOT_DECLARED, HAVE_PROP_TYPES, HAVE_DEFAULT_PROPS, ONYX_ONE_PARAM, MUST_USE_VARIABLE_FOR_ASSIGNMENT,
} = require('../CONST');

const ruleTester = new RuleTester({
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
        ecmaFeatures: {
            // To support use of < in HOC
            jsx: true,

            // To support use of ... operator
            experimentalObjectRestSpread: true,
        },
    },
});

ruleTester.run('onyx-props-must-have-default', rule, {
    invalid: [
        // onyxProp has isRequired
        {
            code: `
            const defaultProps = {
                propKey: false,
            };
            
            Component.defaultProps = defaultProps;
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);
            `,
            errors: [{
                HAVE_PROP_TYPES,
            }],
        },
        {
            code: `
            const propTypes = {
                propKey: PropTypes.bool,
            };
            
            Component.propTypes = propTypes;
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);
            `,
            errors: [{
                HAVE_DEFAULT_PROPS,
            }],
        },
        {
            code: `
            const propTypes = {
                propKey: PropTypes.bool.isRequired,
            };
            
            const defaultProps = {
                propKey: false,
            };
            
            Component.propTypes = propTypes;
            Component.defaultProps = defaultProps;
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);
            `,
            errors: [{
                PROP_TYPE_REQUIRED_FALSE,
            }],
        },
        {
            code: `
            const propTypes = {
                randomProp: PropTypes.bool,
            };
            
            const defaultProps = {
                randomProp: false,
            };
            
            Component.propTypes = propTypes;
            Component.defaultProps = defaultProps;
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);
            `,
            errors: [
                {
                    PROP_TYPE_NOT_DECLARED,
                },
                {
                    PROP_DEEFAULT_NOT_DECLARED,
                },
            ],
        },
        {
            code: `
            const propTypes = {
                propKey: PropTypes.bool,
            };
            
            const defaultProps = {
                propKey: false,
            };
            
            Component.propTypes = propTypes;
            Component.defaultProps = defaultProps;
            export default withOnyx()(Component);
            `,
            errors: [{
                ONYX_ONE_PARAM,
            }],
        },
        {
            code: `
            Component.propTypes = {
                propKey: PropTypes.bool,
            };
            Component.defaultProps = {
                propKey: false,
            };
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);
            `,
            errors: [{
                MUST_USE_VARIABLE_FOR_ASSIGNMENT,
            }],
        },
    ],
    valid: [
        {
            code: `
            const propTypes = {
                propKey: PropTypes.bool,
            };
            
            const defaultProps = {
                propKey: false,
            };
            
            Component.propTypes = propTypes;
            Component.defaultProps = defaultProps;
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);`,
        },
        {
            code: `
            const propTypes = {
                propKey: PropTypes.bool,
            };
            
            const defaultProps = {
                propKey: false,
            };
            
            Component.propTypes = propTypes;
            Component.defaultProps = defaultProps;
            export default compose(
                withOnyx({
                    propKey: {
                        key: ONYXKEYS.key,
                    },
                }),
            )(Component);`,
        },
        {
            code: `
            import {samplePropTypes, sampleDefaultProps} from "./sample-props";

            Component.propTypes = samplePropTypes;
            Component.defaultProps = sampleDefaultProps;
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);`,
        },
        {
            code: `
            import {samplePropTypes, sampleDefaultProps} from "./sample-props";

            const propTypes = samplePropTypes;
            const defaultProps = sampleDefaultProps;

            Component.propTypes = propTypes;
            Component.defaultProps = defaultProps;
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);`,
        },
        {
            code: `
            import {samplePropTypes, sampleDefaultProps} from "./sample-props";

            const propTypes = {
                ...samplePropTypes,
            };

            const defaultProps = {
                ...sampleDefaultProps,
            };

            Component.propTypes = propTypes;
            Component.defaultProps = defaultProps;
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);`,
        },
        {
            code: `
            import * as sampleProps from "./sample-props";

            const propTypes = {
                propKey: sampleProps.samplePropTypes,
            };
            
            const defaultProps = {
                propKey: sampleProps.sampleDefaultProps,
            };

            Component.propTypes = propTypes;
            Component.defaultProps = defaultProps;
            export default withOnyx({
                propKey: {
                    key: ONYXKEYS.key,
                },
            })(Component);`,
        },
        {
            code: `
            export default function (WrappedComponent) {
                const propTypes = {
                    propKey: PropTypes.bool
                };
            
                const defaultProps = {
                    propKey: false,
                };
            
                const WithHOC = (props) => {
                    const extraProp = props.randomProp;
            
                    return (
                        <WrappedComponent
                            {...props}
                        />
                    );
                };
            
                WithHOC.propTypes = propTypes;
                WithHoc.defaultProps = defaultProps;
            
                return withOnyx({
                    propKey: {
                        key: ONYXKEYS.key,
                    }
                })
            }`,
        },
        {
            code: `
            const hocPropTypes = {
                propKey: PropTypes.bool,
            };
            
            const hocDefaultProps = {
                propKey: false,
            }
            export default function (WrappedComponent) {
                const propTypes = {
                    ...hocPropTypes
                };
            
                const defaultProps = {
                    ...hocDefaultProps,
                };
            
                const WithHOC = (props) => {
                    const extraProp = props.randomProp;
            
                    return (
                        <WrappedComponent
                            {...props}
                        />
                    );
                };
            
                WithHOC.propTypes = propTypes;
                WithHoc.defaultProps = defaultProps;
            
                return withOnyx({
                    propKey: {
                        key: ONYXKEYS.key,
                    }
                })
            }`,
        },
    ],
});
