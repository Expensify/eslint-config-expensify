/* eslint-disable no-bitwise */
const _ = require('underscore');
const ts = require('typescript');

function isBoolean(type) {
    if ((type.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLike | ts.TypeFlags.BooleanLiteral)) !== 0) {
        return true;
    }
    return type.isUnion() && _.every(type.types, isBoolean);
}

function isString(type) {
    if ((type.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLike | ts.TypeFlags.StringLiteral)) !== 0) {
        return true;
    }
    return type.isUnion() && _.every(type.types, isString);
}

module.exports = {
    isBoolean,
    isString,
};
