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

'use strict';

import React from "react";
import ReactDOM from "react-dom";
import { pick, merge } from "lodash";

var Ps = require('perfect-scrollbar');

var Scroll = React.createClass({

    propTypes: {
        style: React.PropTypes.object,
        height: React.PropTypes.string,
        wheelSpeed: React.PropTypes.number,
        wheelPropagation: React.PropTypes.bool,
        minScrollbarLength: React.PropTypes.number
    },

    getDefaultProps: function () {
        return {
            height: "400px",
            wheelSpeed: 2,
            wheelPropagation: true,
            minScrollbarLength: 20
        };
    },

    componentDidMount: function () {
        Ps.initialize(ReactDOM.findDOMNode(this.refs.container), pick(this.props, [
            "wheelSpeed",
            "wheelPropagation",
            "minScrollbarLength"
        ]));
    },

    componentWillUnmount: function () {
        Ps.destroy(ReactDOM.findDOMNode(this.refs.container));
    },

    update: function () {
        Ps.update(ReactDOM.findDOMNode(this.refs.container));
    },

    render: function () {

        var style = {
            height: this.props.height,
            position: "relative"
        };

        if (this.props.style) {
            merge(style, this.props.style);
        }

        return (
            <div ref="container" style={style}>
                {this.props.children}
            </div>
        )
    }
});

module.exports = Scroll;