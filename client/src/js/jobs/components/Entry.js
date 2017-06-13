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

import React from "react";
import { capitalize } from "lodash";
import { Row, Col } from "react-bootstrap";
import { Icon, RelativeTime, ListGroupItem, ProgressBar } from "virtool/js/components/Base";
import { getTaskDisplayName } from "virtool/js/utils";

export default class JobEntry extends React.Component {

    constructor (props) {
        super(props);
        this.state = {in: false};
    }

    static propTypes = {
        job_id: React.PropTypes.string.isRequired,
        task: React.PropTypes.string.isRequired,
        state: React.PropTypes.string.isRequired,
        progress: React.PropTypes.number.isRequired,
        added: React.PropTypes.string.isRequired,
        user_id: React.PropTypes.string.isRequired
    };

    render () {

        const canCancel = true;
        const canRemove = true;

        let iconArea = (
            <strong className="pull-right">
                {capitalize(this.props.state)}
            </strong>
        );

        let icon;

        if ((this.props.state === "waiting" || this.props.state === "running") && canCancel) {
            icon = (
                <Icon
                    bsStyle="danger"
                    name="cancel-circle"
                    onClick={this.cancel}
                />
            );
        } else if (canRemove) {
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

        let progressStyle;
        let progressValue = this.props.progress * 100;

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

                <ProgressBar now={progressValue} bsStyle={progressStyle} affixed />

                <Row>
                    <Col md={4}>
                        <strong>{getTaskDisplayName(this.props.task)}</strong>
                    </Col>
                    <Col md={5}>
                         Started <RelativeTime time={this.props.added} /> by {this.props.user_id}
                     </Col>
                    <Col md={3}>
                        {iconArea}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
}
