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
import PropTypes from "prop-types";
import { capitalize } from "lodash";
import { Row, Col } from "react-bootstrap";
import { Icon, RelativeTime, ProgressBar } from "virtool/js/components/Base";
import { getTaskDisplayName } from "virtool/js/utils";

export default class JobEntry extends React.Component {

    static propTypes = {
        id: PropTypes.string.isRequired,
        task: PropTypes.string.isRequired,
        state: PropTypes.string.isRequired,
        progress: PropTypes.number.isRequired,
        created_at: PropTypes.string.isRequired,
        user: PropTypes.object.isRequired,

        navigate: PropTypes.func,
        cancel: PropTypes.func,
        remove: PropTypes.func
    };

    cancel = (event) => {
        event.stopPropagation();
        this.props.cancel(this.props.id);
    };

    remove = (event) => {
        event.stopPropagation();
        this.props.remove(this.props.id);
    };

    render () {

        const canCancel = true;
        const canRemove = true;

        let icon;

        if ((this.props.state === "waiting" || this.props.state === "running") && canCancel) {
            icon = (
                <Icon
                    bsStyle="danger"
                    name="cancel-circle"
                    onClick={this.cancel}
                    pullRight
                />
            );
        } else if (canRemove) {
            icon = (
                <Icon
                    bsStyle="danger"
                    name="remove"
                    onClick={this.remove}
                    pullRight
                />
            );
        }

        let progressStyle;
        let progressValue = this.props.progress * 100;

        if (this.props.state === "running") {
            progressStyle = "success";
        }

        if (this.props.state === "error" || this.props.state === "cancelled") {
            progressStyle = "danger";
        }

        // Create the option components for the selected fields.
        return (
            <div className="spaced job list-group-item" onClick={this.props.navigate}>

                <div className="job-overlay">
                    <Row>
                        <Col md={3} mdOffset={9}>
                            <strong className="pull-right">
                                {capitalize(this.props.state)}
                            </strong>
                        </Col>
                    </Row>
                </div>

                <ProgressBar now={progressValue} bsStyle={progressStyle} affixed />

                <Row>
                    <Col md={4}>
                        <strong>{getTaskDisplayName(this.props.task)}</strong>
                    </Col>
                    <Col md={5}>
                         Started <RelativeTime time={this.props.created_at} /> by {this.props.user.id}
                     </Col>
                    <Col md={3}>
                        {icon}
                    </Col>
                </Row>
            </div>
        );
    }
}
