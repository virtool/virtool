/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ByteSize
 */

import React from "react";
import PropTypes from "prop-types";
import { join } from "lodash";

export class Flex extends React.Component {

    static propTypes = {
        direction: PropTypes.oneOf(["row", "row-reverse", "column", "column-reverse"]),
        wrap: PropTypes.oneOf(["nowrap", "wrap", "wrap-reverse"]),

        justifyContent: PropTypes.oneOf([
            "flex-start",
            "flex-end",
            "center",
            "space-between",
            "space-around"
        ]),

        alignItems: PropTypes.oneOf([
            "flex-start",
            "flex-end",
            "center",
            "stretch",
            "baseline"
        ]),

        alignContent: PropTypes.oneOf([
            "flex-start",
            "flex-end",
            "center",
            "stretch",
            "space-between",
            "space-around"
        ]),

        children: PropTypes.node.isRequired,

        className: PropTypes.string,
        style: PropTypes.object
    };

    static defaultProps = {
        direction: "row",
        wrap: "nowrap",
        justifyContent: "flex-start",
        alignItems: "stretch",
        alignContent: "stretch"
    };

    render () {

        const { justifyContent, alignItems, alignContent } = this.props;

        let style = {
            alignContent,
            alignItems,
            display: "flex",
            flexFlow: join([this.props.direction, this.props.wrap], " "),
            justifyContent
        };

        if (this.props.style) {
            style = {...style, ...this.props.style};
        }

        return (
            <div style={style} className={this.props.className}>
                {this.props.children}
            </div>
        );
    }
}

export class FlexItem extends React.Component {

    static propTypes = {
        grow: PropTypes.number,
        shrink: PropTypes.number,
        basis: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        alignSelf: PropTypes.oneOf(["auto", "flex-start", "flex-end", "center", "baseline", "stretch"]),
        pad: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
        style: PropTypes.object,
        className: PropTypes.string,
        children: PropTypes.node
    };

    static defaultProps = {
        grow: 0,
        shrink: 1,
        basis: "auto",
        alignSelf: null
    };

    render () {

        let style = {
            flex: join([this.props.grow, this.props.shrink, this.props.basis], " "),
            alignSelf: this.props.alignSelf
        };

        if (this.props.pad) {
            style.marginLeft = this.props.pad === true ? "3px": this.props.pad + "px";
        }

        if (this.props.style) {
            style = {...style, ...this.props.style};
        }
        
        return (
            <div style={style} className={this.props.className}>
                {this.props.children}
            </div>
        );
    }

}
