import React from "react";
import PropTypes from "prop-types";

export const Spinner = (props) => {
    let style;

    if (props.color) {
        style = {
            color: props.color
        };
    }

    return (
        <div className="spinner" style={style}>
            <div></div>
        </div>
    );
};

Spinner.propTypes = {
    color: PropTypes.string
};
