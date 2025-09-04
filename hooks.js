const _ = require('lodash');

module.exports = {
    extends: _.map([
        './rules/react-hooks.js',
    ], require.resolve),
    rules: {},
};
