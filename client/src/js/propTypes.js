import React from "react";

export const oneOrMore = (propType) => (
    React.PropTypes.oneOfType([
        propType,
        React.PropTypes.arrayOf(propType)
    ])
);

export const stringOrBool = (
    React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.bool
    ])
);
