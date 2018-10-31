import React from "react";
import PropTypes from "prop-types";

/**
 * A custom implementation of the Bootstrap tooltip component.
 *
 * @func
 * @param children
 * @param header {string} a header for the tooltip
 * @param x {number} x position of the tooltip
 * @param y {number} y position of the tooltip
 */
export const Tooltip = ({ children, header, x, y }) => {
    const tooltipStyle = {
        left: x - 10 + "px",
        top: y - window.pageYOffset - 10 + "px",
        zIndex: 10000
    };

    return (
        <div className="tooltip" style={tooltipStyle}>
            {header ? <div className="tooltip-header">{header}</div> : null}
            <div className="tooltip-body">{children}</div>
        </div>
    );
};

Tooltip.propTypes = {
    x: PropTypes.number,
    y: PropTypes.number,

    header: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),

    children: PropTypes.node
};
