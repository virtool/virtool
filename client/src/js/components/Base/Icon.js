/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Icon
 */

import CX from "classnames";
import React from "react";
import { assign } from "lodash";
import { Tooltip, OverlayTrigger } from "react-bootstrap";

/**
 * Wrapper an IcoMoon icon in an easy React interface.
 *
 * @class
 */
export const Icon = (props) => {

    function handleClick (event) {
        event.stopPropagation();
        props.onClick(event);
    }

    const className = CX(
        props.className,
        props.pending ? "i-spinner spinning": (`i-${props.name}`),
        props.bsStyle && !props.pending ? `text-${props.bsStyle}`: false,
        {
            "pull-right": props.pullRight,
            "fixed-width": props.fixedWidth,
            "hoverable pointer": props.onClick,
        }
    );

    const style = assign(props.pad ? {marginLeft: "3px"}: {}, props.style);

    const icon = <i className={className} style={style} onClick={props.onClick ? handleClick: null} />;

    if (props.tip) {

        const tooltip = (
            <Tooltip id={props.tip}>
                {props.tip}
            </Tooltip>
        );

        return (
            <OverlayTrigger placement={props.tipPlacement || "top"} overlay={tooltip}>
                {icon}
            </OverlayTrigger>
        )
    }

    return icon;

};

Icon.propTypes = {
    name: React.PropTypes.string.isRequired,
    tip: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
    tipPlacement: React.PropTypes.oneOf(["top", "right", "bottom", "left"]),
    onClick: React.PropTypes.func,
    pending: React.PropTypes.bool,
    bsStyle: React.PropTypes.string,
    className: React.PropTypes.string,
    pullRight: React.PropTypes.bool,
    fixedWidth: React.PropTypes.bool,
    style: React.PropTypes.object,
    pad: React.PropTypes.bool
};

Icon.defaultProps = {
    pending: false,
    pullRight: false,
    fixedWidth: false
};
