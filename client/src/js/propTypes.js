import PropTypes from "prop-types";

export const oneOrMore = (propType) => (
    PropTypes.oneOfType([
        propType,
        PropTypes.arrayOf(propType)
    ])
);

export const stringOrBool = (
    PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.bool
    ])
);
