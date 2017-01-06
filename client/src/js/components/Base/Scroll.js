/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Scroll
 */

import React from "react";
import { pick, merge } from "lodash";
import Ps from "perfect-scrollbar";

export class Scroll extends React.Component {

    static propTypes = {
        style: React.PropTypes.object,
        height: React.PropTypes.string,
        wheelSpeed: React.PropTypes.number,
        wheelPropagation: React.PropTypes.bool,
        minScrollbarLength: React.PropTypes.number,
        children: React.PropTypes.node
    };

    static defaultProps = {
        style: {},
        height: "400px",
        wheelSpeed: 2,
        wheelPropagation: true,
        minScrollbarLength: 20
    };

    componentDidMount () {
        Ps.initialize(this.containerNode, pick(this.props, [
            "wheelSpeed",
            "wheelPropagation",
            "minScrollbarLength"
        ]));
    }

    componentWillUnmount () {
        Ps.destroy(this.containerNode);
    }

    update = () => {
        Ps.update(this.containerNode);
    };

    render () {

        let style = merge({
            height: this.props.height,
            position: "relative"
        }, this.props.style);

        return (
            <div ref={this.containerNode} style={style}>
                {this.props.children}
            </div>
        )
    }
}
