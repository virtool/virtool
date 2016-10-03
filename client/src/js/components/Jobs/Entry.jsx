/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobEntry
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var ProgressBar = require('react-bootstrap/lib/ProgressBar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
var JobEntry = React.createClass({

    propTypes: {
        _id: React.PropTypes.string.isRequired,
        task: React.PropTypes.string.isRequired,
        progress: React.PropTypes.number.isRequired,
        added: React.PropTypes.string.isRequired,
        username: React.PropTypes.string.isRequired
    },

    getInitialState: function () {
        return {
            in: false
        };
    },

    showDetail: function () {
        dispatcher.router.setExtra(["detail", this.props._id]);
    },

    remove: function (event) {
        event.stopPropagation();
        dispatcher.db.jobs.request("remove_job", {_id: this.props._id});
    },

    cancel: function (event) {
        event.stopPropagation();
        dispatcher.db.jobs.request("cancel", {_id: this.props._id});
    },

    render: function () {

        var icon;

        if (this.props.state === "waiting" || this.props.state === "running") {
            icon = <Icon bsStyle="danger" name="cancel-circle" onClick={this.cancel} />;
        } else {
            icon = <Icon bsStyle="danger" name="remove" onClick={this.remove} />;
        }

        var progressStyle;
        var progressValue = this.props.progress * 100;

        if (this.props.state === "complete") {
            progressValue = 100;
        }

        if (this.props.state === "running") {
            progressStyle = "success";
        }

        if (this.props.state === "error" || this.props.state === "cancelled") {
            progressValue = 100;
            progressStyle = "danger";
        }

        // Create the option components for the selected fields.
        return (
            <ListGroupItem className="job" onClick={this.showDetail}>

                <ProgressBar now={progressValue} bsStyle={progressStyle} />

                <h5 style={{marginTop: "15px", marginBottom: "5px"}}>
                    <Row>
                        <Col md={4}>
                            <strong>{_.startCase(this.props.task)}</strong>
                        </Col>
                        <Col md={5}>
                             Started <RelativeTime time={this.props.added} /> by {this.props.username}
                         </Col>
                        <Col md={3}>
                            <div className="job-state-overlay">
                                <strong className="pull-right">
                                    {_.capitalize(this.props.state)}
                                </strong>
                            </div>
                            <div className="job-icons pull-right">
                                {icon}
                            </div>
                        </Col>
                    </Row>
                </h5>
            </ListGroupItem>
        );
    }
});

module.exports = JobEntry;
