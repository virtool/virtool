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
import { assign } from "lodash-es";
import { Tooltip, OverlayTrigger } from "react-bootstrap";

/**
 * Wrapper an IcoMoon icon in an easy React interface.
 *
 * @class
 */
export default class Icon extends React.Component {

    static propTypes = {
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

    static defaultProps = {
        pending: false,
        pullRight: false,
        fixedWidth: false
    };

    handleClick = (event) => {
        event.stopPropagation();
        this.props.onClick(event);
    };

    render () {
        const className = CX(
            this.props.className,
            this.props.pending ? "i-spinner spinner": ("i-" + this.props.name),
            this.props.bsStyle && !this.props.pending ? "text-" + this.props.bsStyle: false,

            {
                "pull-right": this.props.pullRight,
                "fixed-width": this.props.fixedWidth,
                "hoverable pointer": this.props.onClick,
            }
        );

        const style = assign(this.props.pad ? {marginLeft: "3px"}: {}, this.props.style);

        const icon = <i className={className} style={style} onClick={this.props.onClick ? this.handleClick: null} />;

        if (this.props.tip) {

            const tooltip = (
                <Tooltip id={this.props.tip}>
                    {this.props.tip}
                </Tooltip>
            );

            return (
                <OverlayTrigger placement={this.props.tipPlacement || "top"} overlay={tooltip}>
                    {icon}
                </OverlayTrigger>
            )
        }

        return icon;
    }
}
