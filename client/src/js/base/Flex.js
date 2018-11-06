/**
 * Components for simplifying one-off uses of Flex box.
 *
 */
import React from "react";
import PropTypes from "prop-types";
import { join } from "lodash-es";

/**
 * A configurable component that acts as a flex container.
 */
export function Flex(props) {
    const { alignContent, alignItems, children, className, direction, justifyContent, wrap } = props;

    let style = {
        alignContent,
        alignItems,
        display: "flex",
        flexFlow: join([direction, wrap], " "),
        justifyContent
    };

    if (props.style) {
        style = { ...style, ...props.style };
    }

    return (
        <div style={style} className={className}>
            {children}
        </div>
    );
}

Flex.propTypes = {
    direction: PropTypes.oneOf(["row", "row-reverse", "column", "column-reverse"]),
    wrap: PropTypes.oneOf(["nowrap", "wrap", "wrap-reverse"]),
    justifyContent: PropTypes.oneOf(["flex-start", "flex-end", "center", "space-between", "space-around"]),

    alignItems: PropTypes.oneOf(["flex-start", "flex-end", "center", "stretch", "baseline"]),

    alignContent: PropTypes.oneOf(["flex-start", "flex-end", "center", "stretch", "space-between", "space-around"]),
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    style: PropTypes.object
};

Flex.defaultProps = {
    direction: "row",
    wrap: "nowrap",
    justifyContent: "flex-start",
    alignItems: "stretch",
    alignContent: "stretch"
};

export class FlexItem extends React.Component {
    static propTypes = {
        grow: PropTypes.number,
        shrink: PropTypes.number,
        style: PropTypes.object,
        className: PropTypes.string,
        children: PropTypes.node,
        basis: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        alignSelf: PropTypes.oneOf(["auto", "flex-start", "flex-end", "center", "baseline", "stretch"]),
        pad: PropTypes.oneOfType([PropTypes.bool, PropTypes.number])
    };

    static defaultProps = {
        grow: 0,
        shrink: 1,
        basis: "auto",
        alignSelf: null
    };

    render() {
        let style = {
            flex: join([this.props.grow, this.props.shrink, this.props.basis], " "),
            alignSelf: this.props.alignSelf
        };

        if (this.props.pad) {
            style.marginLeft = this.props.pad === true ? "3px" : this.props.pad + "px";
        }

        if (this.props.style) {
            style = { ...style, ...this.props.style };
        }

        return (
            <div style={style} className={this.props.className}>
                {this.props.children}
            </div>
        );
    }
}
