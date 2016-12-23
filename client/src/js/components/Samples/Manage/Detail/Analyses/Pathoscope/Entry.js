"use strict";

import { formatIsolateName } from "virtool/js/utils";

var CX = require("classnames");
import React from "react";
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Label = require('react-bootstrap/lib/Label');

var Flex = require('virtool/js/components/Base/Flex');

var PathoscopeEntry = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return this.props.in !== nextProps.in || this.props.showReads !== nextProps.showReads;
    },

    toggleIn: function () {
        this.props.toggleIn(this.props._id);
    },

    render: function () {

        var className = CX({
            "list-group-item": true,
            "hoverable": !this.props.in,
            "spaced": true
        });

        var closeButton;

        if (this.props.in) {
            closeButton = (
                <button type="button" className="close" onClick={this.toggleIn}>
                    <span>×</span>
                </button>
            );
        }

        var flexStyle = {
            height: "21px"
        };

        var piValue = this.props.showReads ? this.props.reads: toScientificNotation(this.props.pi);

        return (
            <div className={className} onClick={this.props.in ? null: this.toggleIn}>
                <Row>
                    <Col md={6}>
                        <Flex>
                            <Flex.Item>
                                {this.props.name}
                            </Flex.Item>
                            <Flex.Item pad={5}>
                                <small className="text-primary">
                                    <strong className="text-warning">
                                        {this.props.abbreviation}
                                    </strong>
                                </small>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex alignItems="center" style={flexStyle}>
                            <Flex.Item>
                                <Label>{this.props.showReads ? "Reads": "Weight"}</Label>
                            </Flex.Item>
                            <Flex.Item pad={5}>
                                <strong className="text-success">
                                    {piValue}
                                </strong>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex alignItems="center" alignContent="center" style={flexStyle}>
                            <Flex.Item>
                                <Label>Best Hit</Label>
                            </Flex.Item>
                            <Flex.Item pad={5}>
                                <strong className="text-danger">
                                    {toScientificNotation(this.props.best)}
                                </strong>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex alignItems="center" style={flexStyle}>
                            <Flex.Item>
                                <Label>Coverage</Label>
                            </Flex.Item>
                            <Flex.Item grow={1} pad={5}>
                                <strong className="text-primary">
                                    {toScientificNotation(this.props.coverage)}
                                </strong>
                            </Flex.Item>
                            <Flex.Item>
                                {closeButton}
                            </Flex.Item>
                        </Flex>
                    </Col>
                </Row>
            </div>
        );

    }

});

module.exports = PathoscopeEntry;

