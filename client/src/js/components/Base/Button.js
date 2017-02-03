/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Button
 */

import React from "react";
import CX from "classnames";
import { Tooltip, OverlayTrigger } from "react-bootstrap";
import { Icon, bsStyles } from "./";

/**
 * A react-bootstrap button that does not retain focus when clicked.
 */
export class Button extends React.Component {

    static propTypes = {
        type: React.PropTypes.oneOf(["button", "submit"]),
        bsSize: React.PropTypes.oneOf(["xsmall", "small", "large"]),
        bsStyle: React.PropTypes.oneOf(bsStyles),
        active: React.PropTypes.bool,
        disabled: React.PropTypes.bool,
        block: React.PropTypes.bool,
        pullRight: React.PropTypes.bool,
        onClick: React.PropTypes.func,
        style: React.PropTypes.object,
        icon: React.PropTypes.string,
        iconStyle: React.PropTypes.oneOf(bsStyles),
        pad: React.PropTypes.bool,

        tip: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
        tipPlacement: React.PropTypes.oneOf(["top", "right", "bottom", "left"]),

        children: React.PropTypes.node
    };

    static defaultProps = {
        bsStyle: "default",
        pullRight: false
    };

    blur = () =>  {
        this.buttonNode.blur();
    };

    render () {

        const className = CX("btn", `btn-${this.props.bsStyle}`, {
            "btn-block": this.props.block,
            "pull-right": this.props.pullRight,
            "active": this.props.active,
            "btn-xs": this.props.bsSize === "xsmall",
            "btn-sm": this.props.bsSize === "small",
            "btn-lg": this.props.bsSize === "large",
            "btn-with-icon": this.props.icon,
            "btn-padded": this.props.pad
        });

        let icon;

        if (this.props.icon) {
            icon = <Icon name={this.props.icon} className={`text-${this.props.iconStyle}`} />;
        }

        let children;

        if (this.props.children) {
            children = <span>{this.props.children}</span>
        }

        const button = (
            <button
                type={this.props.type}
                ref={(button) => this.buttonNode = button}
                onFocus={this.blur}
                className={className}
                onClick={this.props.onClick}
                style={this.props.style}
                disabled={this.props.disabled}
            >
                {icon}{children}
            </button>
        );

        if (this.props.tip) {

            const tooltip = (
                <Tooltip id={this.props.tip}>
                    {this.props.tip}
                </Tooltip>
            );

            return (
                <OverlayTrigger placement={this.props.tipPlacement || "top"} overlay={tooltip}>
                    {button}
                </OverlayTrigger>
            )
        }

        return button;
    }
}
