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

"use strict";

import React from "react";
import { pick, join, merge, assign } from "lodash";

export class Flex extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        direction: React.PropTypes.oneOf(["row", "row-reverse", "column", "column-reverse"]),
        wrap: React.PropTypes.oneOf(["nowrap", "wrap", "wrap-reverse"]),

        justifyContent: React.PropTypes.oneOf([
            "flex-start",
            "flex-end",
            "center",
            "space-between",
            "space-around"
        ]),

        alignItems: React.PropTypes.oneOf([
            "flex-start",
            "flex-end",
            "center",
            "stretch",
            "baseline"
        ]),

        alignContent: React.PropTypes.oneOf([
            "flex-start",
            "flex-end",
            "center",
            "stretch",
            "space-between",
            "space-around"
        ]),

        className: React.PropTypes.string,

        style: React.PropTypes.object
    }

    static defaultProps = {
        direction: "row",
        wrap: "nowrap",
        justifyContent: "flex-start",
        alignItems: "stretch",
        alignContent: "stretch"
    }

    render () {

        let style = pick(this.props, ["justifyContent", "alignItems", "alignContent"]);

        style.flexFlow = join([this.props.direction, this.props.wrap], " ");
        style.display = "flex";

        if (this.props.style) {
            merge(style, this.props.style);
        }

        return (
            <div style={style} className={this.props.className}>
                {this.props.children}
            </div>
        );
    }
}

export class FlexItem extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        grow: React.PropTypes.number,
        shrink: React.PropTypes.number,
        basis: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
        alignSelf: React.PropTypes.oneOf(["auto", "flex-start", "flex-end", "center", "baseline", "stretch"]),
        pad: React.PropTypes.oneOfType([React.PropTypes.bool, React.PropTypes.number]),
        style: React.PropTypes.object
    }

    static defaultProps = {
        grow: 0,
        shrink: 1,
        basis: "auto",
        alignSelf: null
    }

    render () {

        let style = {
            flex: join([this.props.grow, this.props.shrink, this.props.basis], " "),
            alignSelf: this.props.alignSelf
        };

        if (this.props.pad) {
            style.marginLeft = this.props.pad === true ? "3px": this.props.pad + "px";
        }

        if (this.props.style) {
            merge(style, this.props.style)
        }

        assign(style, this.props.style);
        
        return (
            <div style={style} className={this.props.className}>
                {this.props.children}
            </div>
        );
    }

}