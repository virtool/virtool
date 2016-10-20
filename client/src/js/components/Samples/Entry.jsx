/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SampleEntry
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Label = require('react-bootstrap/lib/Label');
var ProgressBar = require('react-bootstrap/lib/ProgressBar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
var SampleEntry = React.createClass({

    getInitialState: function () {
        return {
            in: false
        };
    },

    showDetail: function () {
        dispatcher.router.setExtra(["detail", this.props._id]);
    },

    archive: function (event) {
        event.stopPropagation();
        dispatcher.db.samples.request("archive", {_id: this.props._id});
    },

    render: function () {

        console.log(this.props);

        var analysisLabel;

        if (this.props.analyzed) {
            analysisLabel = (
                <Flex.Item pad>
                    <Label bsStyle={this.props.analyzed === true ? "primary": null}>
                        <Icon name="checkmark" pending={this.props.analyzed === "ip"} /> Analysis
                    </Label>
                </Flex.Item>
            );
        }

        return (
            <ListGroupItem className="spaced" onClick={this.showDetail}>
                <Row>
                    <Col md={4}>
                        <Flex>
                            <Flex.Item>
                                <Checkbox />
                            </Flex.Item>
                            <Flex.Item grow={1} pad={10}>
                                <strong>{this.props.name}</strong>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex>
                            <Flex.Item>
                                <Label bsStyle={this.props.imported === true ? "primary": null}>
                                    <Icon name="checkmark" pending={this.props.imported === "ip"} /> Import
                                </Label>
                            </Flex.Item>
                            {analysisLabel}
                        </Flex>
                    </Col>
                    <Col md={3}>
                        Added <RelativeTime time={this.props.added} /> by {this.props.username}
                    </Col>
                    <Col md={1}>
                        <Icon
                            name='box-add'
                            bsStyle='info'
                            onClick={this.archive}
                            pullRight
                        />
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
});

module.exports = SampleEntry;
