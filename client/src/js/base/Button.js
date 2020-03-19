import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import CX from "classnames";
import { NavLink } from "react-router-dom";
import { Tooltip } from "./Tooltip";
import { Icon } from "./Icon";
import { bsStyles } from "./utils";

const StyledLinkButton = styled(NavLink)`
    align-items: center;
    background-color: #07689d;
    color: #ffffff;
    cursor: pointer;
    display: inline-flex;
    justify-content: center;
    margin-bottom: 0;
    min-width: 45px;
    padding: 6px 12px;
    text-align: center;
    white-space: nowrap;
    user-select: none;
    text-decoration: none !important;

    &:hover {
        background-color: #05486c;
        border-color: #03314a;
        color: #ffffff;
    }

    &:focus {
        color: #ffffff;
    }
`;

export const LinkButton = ({ children, className, to }) => (
    <StyledLinkButton className={className} to={to} activeClassName="active">
        {children}
    </StyledLinkButton>
);

export class Button extends React.Component {
    static propTypes = {
        bsStyle: PropTypes.oneOf(bsStyles),
        active: PropTypes.bool,
        className: PropTypes.string,
        disabled: PropTypes.bool,
        block: PropTypes.bool,
        pullRight: PropTypes.bool,
        onBlur: PropTypes.func,
        onClick: PropTypes.func,
        style: PropTypes.object,
        icon: PropTypes.string,
        iconStyle: PropTypes.oneOf(bsStyles),
        pad: PropTypes.bool,
        children: PropTypes.node,
        type: PropTypes.oneOf(["button", "submit"]),
        bsSize: PropTypes.oneOf(["xsmall", "small", "large"]),
        tip: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        tipPlacement: PropTypes.oneOf(["top", "right", "bottom", "left"])
    };

    static defaultProps = {
        bsStyle: "default",
        pullRight: false,
        tipPlacement: "top"
    };

    blur = () => {
        this.buttonNode.blur();
    };

    render() {
        const className = CX("btn", `btn-${this.props.bsStyle}`, this.props.className, {
            "btn-block": this.props.block,
            "pull-right": this.props.pullRight,
            active: this.props.active,
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

        const button = (
            <button
                type={this.props.type}
                ref={node => (this.buttonNode = node)}
                onBlur={this.props.onBlur}
                className={className}
                onClick={this.props.onClick}
                style={this.props.style}
                disabled={this.props.disabled}
            >
                <div>
                    {icon}
                    {this.props.children ? <span>{this.props.children}</span> : null}
                </div>
            </button>
        );

        if (this.props.tip) {
            return <Tooltip tip={this.props.tip}>{button}</Tooltip>;
        }

        return button;
    }
}
