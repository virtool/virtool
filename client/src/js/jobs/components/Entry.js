import React from "react";
import PropTypes from "prop-types";
import { capitalize, noop } from "lodash-es";
import { Row, Col } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import { Icon, RelativeTime, ProgressBar } from "../../base";
import { getTaskDisplayName } from "../../utils";
import { cancelJob, removeJob } from "../actions";

export class JobEntry extends React.Component {

    static propTypes = {
        id: PropTypes.string.isRequired,
        task: PropTypes.string.isRequired,
        state: PropTypes.string.isRequired,
        progress: PropTypes.number.isRequired,
        created_at: PropTypes.string.isRequired,
        user: PropTypes.object.isRequired,
        onNavigate: PropTypes.func,
        onCancel: PropTypes.func,
        onRemove: PropTypes.func
    };

    handleCancel = (e) => {
        e.stopPropagation();
        this.props.onCancel(this.props.id);
    };

    handleNavigate = (e) => {
        e.stopPropagation();
        this.props.onNavigate(this.props.id);
    };

    handleRemove = (e) => {
        e.stopPropagation();
        this.props.onRemove(this.props.id);
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
                    onClick={this.handleCancel}
                    pullRight
                />
            );
        } else if (canRemove) {
            icon = (
                <Icon
                    bsStyle="danger"
                    name="remove"
                    onClick={this.handleRemove}
                    pullRight
                />
            );
        }

        let progressStyle;

        const progressValue = this.props.progress * 100;

        if (this.props.state === "running") {
            progressStyle = "success";
        }

        if (this.props.state === "error" || this.props.state === "cancelled") {
            progressStyle = "danger";
        }

        // Create the option components for the selected fields.
        return (
            <div className="spaced job list-group-item" onClick={this.handleNavigate}>

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

const mapDispatchToProps = (dispatch) => ({

    onCancel: (jobId) => {
        dispatch(cancelJob(jobId));
    },

    onNavigate: (jobId) => {
        dispatch(push(`/jobs/${jobId}`));
    },

    onRemove: (jobId) => {
        dispatch(removeJob(jobId));
    }
});

export default connect(noop(), mapDispatchToProps)(JobEntry);
