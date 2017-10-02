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
import PropTypes from "prop-types";
import { pick, assign } from "lodash";
import Ps from "perfect-scrollbar";

export class Scroll extends React.Component {

    static propTypes = {
        style: PropTypes.object,
        height: PropTypes.string,
        wheelSpeed: PropTypes.number,
        wheelPropagation: PropTypes.bool,
        minScrollbarLength: PropTypes.number,
        children: PropTypes.node
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

        let style = assign({
            height: this.props.height,
            position: "relative"
        }, this.props.style);

        return (
            <div ref={(node) => this.containerNode = node} style={style}>
                {this.props.children}
            </div>
        )
    }
}
