var d3 = require('d3');
import React from "react";
var Table = require('react-bootstrap/lib/Table');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon');

var List = require('./List');
var Tip = require('./Tip');

var Report = React.createClass({

    getInitialState: function () {
        return {
            content: null,
            x: null,
            y: null
        };
    },

    showPopover: function (d, x, y, container) {
        if (!this.state.content) {
            this.setState({
                content: d,
                x: x,
                y: y,
                container: container
            });
        }
    },

    hidePopover: function () {
        this.setState({
            content: null,
            x: null,
            y: null,
            container: null
        });
    },

    render: function () {

        var tooltip;

        if (this.state.content) {
            tooltip = (
                <Tip
                    x={this.state.x}
                    y={this.state.y}
                    content={this.state.content}
                    container={this.state.container}
                />
            );
        }

        return (
            <div>
                <List
                    {...this.props}
                    content={this.state.content}
                    showPopover={this.showPopover}
                    hidePopover={this.hidePopover}
                />
                {tooltip}
            </div>
        );
    }
});

module.exports = Report;