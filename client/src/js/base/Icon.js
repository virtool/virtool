import CX from "classnames";
import React from "react";
import PropTypes from "prop-types";
import { Tooltip, OverlayTrigger } from "react-bootstrap";

/**
 * A component for rendering a font icon. A tooltip can optionally be shown on hover.
 *
 */
export const Icon = props => {
    function handleClick(e) {
        e.stopPropagation();
        props.onClick(e);
    }

    const className = CX(props.className, `${props.faStyle} fa-${props.name}`, {
        [`text-${props.bsStyle}`]: props.bsStyle,
        "pull-right": props.pullRight,
        "fixed-width": props.fixedWidth,
        "hoverable pointer": props.onClick
    });

    const style = { ...(props.pad ? { marginLeft: "3px" } : {}), ...props.style };

    const icon = <i className={className} style={style} onClick={props.onClick ? handleClick : null} />;

    if (props.tip) {
        const tooltip = <Tooltip id={props.tip}>{props.tip}</Tooltip>;

        return (
            <OverlayTrigger placement={props.tipPlacement || "top"} overlay={tooltip}>
                {icon}
            </OverlayTrigger>
        );
    }

    return icon;
};

Icon.propTypes = {
    name: PropTypes.string.isRequired,
    tip: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    tipPlacement: PropTypes.oneOf(["top", "right", "bottom", "left"]),
    faStyle: PropTypes.string,
    onClick: PropTypes.func,
    bsStyle: PropTypes.string,
    className: PropTypes.string,
    pullRight: PropTypes.bool,
    fixedWidth: PropTypes.bool,
    style: PropTypes.object,
    pad: PropTypes.bool
};

Icon.defaultProps = {
    faStyle: "fas",
    pullRight: false,
    fixedWidth: false
};
