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

var Pulse = React.createClass({

    render: function () {
        return (
            <div className="spinner" style={{marginBottom: "-1px"}}>
                <div className="double-bounce1"></div>
                <div className="double-bounce2"></div>
            </div>
        );
    }

});

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

        var analysisLabel;

        if (this.props.analyzed) {
            analysisLabel = (
                <Flex.Item className="bg-primary sample-label" pad>
                    {this.props.analyzed === "ip" ? <Pulse />: <Icon name="checkmark" />} Analysis
                </Flex.Item>
            );
        }

        var actionIcon;

        if (this.props.analyzed) {
            actionIcon = (
                <Icon
                    name='box-add'
                    bsStyle='info'
                    onClick={this.archive}
                />
            );

        } else {
            actionIcon = (
                <Icon
                    name='bars'
                    bsStyle='success'
                    onClick={this.quickAnalyze}
                />
            );
        }

        if (!this.props.archived) {

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
                    <Col md={3}>
                        <Flex>
                            <Flex.Item className="bg-primary sample-label">
                                    {this.props.imported === true ? <Icon name="checkmark" />: <Pulse />} Import
                            </Flex.Item>
                            {analysisLabel}
                        </Flex>
                    </Col>
                    <Col md={3}>
                        Added <RelativeTime time={this.props.added} /> by {this.props.username}
                    </Col>
                    <Col md={2}>
                        <div className="pull-right">
                            {actionIcon}
                        </div>
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
});

module.exports = SampleEntry;
