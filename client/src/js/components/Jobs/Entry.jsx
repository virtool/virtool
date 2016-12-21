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

import React from "react";
import { capitalize, startCase } from "lodash";
import { Row, Col, ProgressBar } from "react-bootstrap";

import Icon from 'virtool/js/components/Base/Icon.jsx';
import RelativeTime from 'virtool/js/components/Base/RelativeTime.jsx';
import ListGroupItem from 'virtool/js/components/Base/PushListGroupItem.jsx';

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

        var iconArea = (
            <strong className="pull-right">
                {capitalize(this.props.state)}
            </strong>
        );

        var icon;

        if ((this.props.state === "waiting" || this.props.state === "running") && this.props.canCancel) {
            icon = (
                <Icon
                    bsStyle="danger"
                    name="cancel-circle"
                    onClick={this.cancel}
                />
            );
        } else if (this.props.canRemove) {
            icon = (
                <Icon
                    bsStyle="danger"
                    name="remove"
                    onClick={this.remove}
                />
            );
        }

        if (icon) {
            iconArea = (
                <div>
                    <div className="job-state-overlay">
                        {iconArea}
                    </div>
                    <div className="job-icons pull-right">
                        {icon}
                    </div>
                </div>
            );
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
            <ListGroupItem className="spaced job" onClick={this.showDetail}>

                <ProgressBar now={progressValue} bsStyle={progressStyle} />

                <h5 style={{marginTop: "15px", marginBottom: "5px"}}>
                    <Row>
                        <Col md={4}>
                            <strong>{startCase(this.props.task)}</strong>
                        </Col>
                        <Col md={5}>
                             Started <RelativeTime time={this.props.added} /> by {this.props.username}
                         </Col>
                        <Col md={3}>
                            {iconArea}
                        </Col>
                    </Row>
                </h5>
            </ListGroupItem>
        );
    }
});

module.exports = JobEntry;
