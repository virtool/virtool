import React from "react";

export const Tooltip = (props) => {

    const tooltipStyle = {
        left: (props.x - 10) + "px",
        top: (props.y - window.pageYOffset - 10) + "px",
        zIndex: 10000
    };

    let header;

    if (props.header) {
        header = (
            <div className="tooltip-header">
                {props.header}
            </div>
        );
    }

    return (
        <div className="tooltip" style={tooltipStyle}>
            {header}
            <div className="tooltip-body">
                {props.children}
            </div>
        </div>
    );
};

Tooltip.propTypes = {
    x: React.PropTypes.number,
    y: React.PropTypes.number,

    header: React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.element
    ]),

    children: React.PropTypes.node
};
