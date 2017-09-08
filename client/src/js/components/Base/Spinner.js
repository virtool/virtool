import React from "react";

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
    color: React.PropTypes.string
};
