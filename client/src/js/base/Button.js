import React from "react";
import styled from "styled-components";
import PropTypes from "prop-types";
import CX from "classnames";
import { NavLink } from "react-router-dom";
import { get } from "lodash-es";
import { Tooltip } from "./Tooltip";
import { Icon } from "./Icon";

const getButtonBackgoundColor = ({ color, theme }) => get(theme, ["color", `${color}Dark`], "inherit");

const StyledButton = styled.button`
    background-color: ${getButtonBackgoundColor};
    color: ${props => (props.color ? "white" : "#333")};
    border: ${props => (props.color ? " " : "1px solid #CBD5E0")};
    opacity: ${props => (props.disabled ? "" : 0.8)};

    &:hover {
        opacity: ${props => (props.disabled ? "" : 1)};
        color: ${props => (props.color ? "white" : "inherit")};
    }
`;

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

export const LinkButton = ({ children, className, replace, to }) => (
    <StyledLinkButton className={className} to={to} replace={replace} activeClassName="active">
        {children}
    </StyledLinkButton>
);

export class Button extends React.Component {
    static propTypes = {
        color: PropTypes.string,
        active: PropTypes.bool,
        className: PropTypes.string,
        disabled: PropTypes.bool,

        onBlur: PropTypes.func,
        onClick: PropTypes.func,
        icon: PropTypes.string,

        children: PropTypes.node,
        type: PropTypes.oneOf(["button", "submit"]),

        tip: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        tipPlacement: PropTypes.oneOf(["top", "right", "bottom", "left"])
    };

    static defaultProps = {
        tipPlacement: "top",
        disabled: false
    };

    blur = () => {
        this.buttonNode.blur();
    };

    render() {
        const className = CX("btn", this.props.className, {
            active: this.props.active,
            "btn-with-icon": this.props.icon
        });

        let icon;

        if (this.props.icon) {
            icon = <Icon name={this.props.icon} />;
        }

        const button = (
            <StyledButton
                type={this.props.type}
                ref={node => (this.buttonNode = node)}
                onBlur={this.props.onBlur}
                className={className}
                onClick={this.props.onClick}
                disabled={this.props.disabled}
                color={this.props.color}
            >
                <div>
                    {icon}
                    {this.props.children ? <span>{this.props.children}</span> : null}
                </div>
            </StyledButton>
        );

        if (this.props.tip) {
            return <Tooltip tip={this.props.tip}>{button}</Tooltip>;
        }

        return button;
    }
}
