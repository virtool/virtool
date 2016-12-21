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
var Pulse = require('virtool/js/components/Base/Pulse.jsx');
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
            in: false,
            pendingQuickAnalyze: false
        };
    },

    showDetail: function () {
        dispatcher.router.setExtra(["detail", this.props._id]);
    },

    quickAnalyze: function (event) {
        event.stopPropagation();

        if (dispatcher.user.settings.skip_quick_analyze_dialog) {
            this.setState({pendingQuickAnalyze: true}, function () {
                dispatcher.db.samples.request('analyze', {
                    samples: [this.props._id],
                    algorithm: dispatcher.user.settings.quick_analyze_algorithm,
                    name: null
                })
                .success(function () {
                    this.setState({
                        pendingQuickAnalyze: false
                    })
                }, this)
                .failure(function () {
                    this.setState({
                        pendingQuickAnalyze: false
                    })
                }, this)
            });
        } else {
            dispatcher.router.setExtra(["quick-analyze", this.props._id]);
        }
    },

    toggleSelect: function (event) {
        event.stopPropagation();
        this.props.toggleSelect(this.props._id);
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
                    {this.props.analyzed === "ip" ? <Pulse />: <Icon name="bars" />} Analysis
                </Flex.Item>
            );
        }

        var analyzeIcon;
        var archiveIcon;

        if (!this.props.selected) {
            analyzeIcon = (
                <Flex.Item>
                    <Icon
                        name="bars"
                        tip="Quick Analyze"
                        tipPlacement="left"
                        bsStyle="success"
                        onClick={this.quickAnalyze}
                    />
                </Flex.Item>
            );

            if (this.props.analyzed === true && !this.props.archived) {
                archiveIcon = (
                    <Flex.Item pad={5}>
                        <Icon
                            name='box-add'
                            tip="Archive"
                            tipPlacement="top"
                            bsStyle='info'
                            onClick={this.archive}
                        />
                    </Flex.Item>
                );

            }
        }

        return (
            <ListGroupItem className="spaced" onClick={this.props.selecting ? this.toggleSelect: this.showDetail}>
                <Row>
                    <Col md={4}>
                        <Flex>
                            <Flex.Item>
                                <Checkbox checked={this.props.selected} onClick={this.toggleSelect} />
                            </Flex.Item>
                            <Flex.Item grow={1} pad={10}>
                                <strong>{this.props.name}</strong>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex>
                            <Flex.Item className="bg-primary sample-label">
                                {this.props.imported === true ? <Icon name="filing" />: <Pulse />} Import
                            </Flex.Item>
                            {analysisLabel}
                        </Flex>
                    </Col>
                    <Col md={3}>
                        Added <RelativeTime time={this.props.added} /> by {this.props.username}
                    </Col>
                    <Col md={2}>
                        <Flex className="pull-right">
                            {analyzeIcon}
                            {archiveIcon}
                        </Flex>
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
});

module.exports = SampleEntry;
