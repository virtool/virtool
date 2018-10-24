import React from "react";
import PropTypes from "prop-types";
import CX from "classnames";
import { Tooltip, OverlayTrigger } from "react-bootstrap";
import { Icon } from "./Icon";
import { bsStyles } from "./utils";

/**
 * A extension of the <Button /> component from react-bootstrap. Adds the features:
 *  - blur on click
 *  - optional tooltip
 *
 * @class
 */
export class Button extends React.Component {
  static propTypes = {
    bsStyle: PropTypes.oneOf(bsStyles),
    active: PropTypes.bool,
    disabled: PropTypes.bool,
    block: PropTypes.bool,
    pullRight: PropTypes.bool,
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
    const className = CX("btn", `btn-${this.props.bsStyle}`, {
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
      icon = (
        <Icon
          name={this.props.icon}
          className={`text-${this.props.iconStyle}`}
        />
      );
    }

    const button = (
      <button
        type={this.props.type}
        ref={node => (this.buttonNode = node)}
        onFocus={this.blur}
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
      const tooltip = <Tooltip id={this.props.tip}>{this.props.tip}</Tooltip>;

      return (
        <OverlayTrigger placement={this.props.tipPlacement} overlay={tooltip}>
          {button}
        </OverlayTrigger>
      );
    }

    return button;
  }
}
