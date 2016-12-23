import { formatIsolateName } from "virtool/js/utils";

import React from "react";
var ReactDOM = require("react-dom");
var Col = require('react-bootstrap/lib/Col');
var Badge = require('react-bootstrap/lib/Badge');
var Label = require('react-bootstrap/lib/Label');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Flex = require('virtool/js/components/Base/Flex');

var Coverage = require('./Coverage');

var PathoscopeIsolate = React.createClass({

    componentDidMount: function () {
        ReactDOM.findDOMNode(this.refs.chart).addEventListener("scroll", this.handleScroll);
    },

    componentWillUnmount: function () {
        ReactDOM.findDOMNode(this.refs.chart).removeEventListener("scroll", this.handleScroll);
    },

    scrollTo: function (scrollLeft) {
        ReactDOM.findDOMNode(this.refs.chart).scrollLeft = scrollLeft;
    },

    handleScroll: function (event) {
        this.props.setScroll(this.props.virusId, event.target.scrollLeft);
    },

    render: function () {

        var chartContainerStyle = {
            overflowX: "scroll",
            whiteSpace: "nowrap"
        };

        var sorted = this.props.hits.sort(function (hit) {
            return hit.align.length;
        });

        var hitComponents = sorted.map(function (hit, index) {
            return (
                <Coverage
                    key={hit.accession}
                    data={hit.align}
                    accession={hit.accession}
                    definition={hit.definition}
                    yMax={this.props.maxDepth}
                    showYAxis={index === sorted.length - 1}
                    isolateComponent={this}
                />
            );
        }, this);

        var piValue = this.props.showReads ? this.props.reads: toScientificNotation(this.props.pi);

        return (
            <div>
                <div className="pathoscope-isolate-header">
                    <Flex>
                        <Flex.Item>
                            {this.props.name}
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <strong className="small text-success">
                                {piValue}
                            </strong>
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <strong className="small text-danger">
                                {toScientificNotation(this.props.best)}
                            </strong>
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <strong className="small text-primary">
                                {toScientificNotation(this.props.coverage)}
                            </strong>
                        </Flex.Item>
                    </Flex>
                </div>
                <div ref="chart" style={chartContainerStyle}>
                    {hitComponents}
                </div>
            </div>
        );

    }

});

module.exports = PathoscopeIsolate;

