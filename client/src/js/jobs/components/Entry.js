import React from "react";
import PropTypes from "prop-types";
import { capitalize, get } from "lodash-es";
import { Row, Col } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import { Icon, RelativeTime, ProgressBar } from "../../base";
import { getTaskDisplayName } from "../../utils";
import { cancelJob, removeJob } from "../actions";

export class JobEntry extends React.Component {

    static propTypes = {
        index: PropTypes.number,
        entry: PropTypes.object,
        onNavigate: PropTypes.func,
        onCancel: PropTypes.func,
        onRemove: PropTypes.func,
        canRemove: PropTypes.bool,
        canCancel: PropTypes.bool
    };

    handleCancel = (e) => {
        e.stopPropagation();
        this.props.onCancel(this.props.entry.id);
    };

    handleNavigate = (e) => {
        e.stopPropagation();
        this.props.onNavigate(this.props.entry.id);
    };

    handleRemove = (e) => {
        e.stopPropagation();
        this.props.onRemove(this.props.entry.id);
    };

    render () {

        let icon;

        if ((this.props.entry.state === "waiting" || this.props.entry.state === "running")
            && this.props.canCancel) {
            icon = (
                <Icon
                    bsStyle="danger"
                    name="ban"
                    onClick={this.handleCancel}
                    pullRight
                />
            );
        } else if (this.props.canRemove) {
            icon = (
                <Icon
                    bsStyle="danger"
                    name="trash"
                    onClick={this.handleRemove}
                    pullRight
                />
            );
        }

        let progressStyle = "success";

        const progressValue = this.props.entry.progress * 100;

        if (this.props.entry.state === "running") {
            progressStyle = "warning";
        }

        if (this.props.entry.state === "error" || this.props.entry.state === "cancelled") {
            progressStyle = "danger";
        }

        // Create the option components for the selected fields.
        return (
            <div className="spaced job list-group-item" onClick={this.handleNavigate}>

                <div className="job-overlay">
                    <Row>
                        <Col md={3} mdOffset={9}>
                            <strong className="pull-right">
                                {capitalize(this.props.entry.state)}
                            </strong>
                        </Col>
                    </Row>
                </div>

                <ProgressBar now={progressValue} bsStyle={progressStyle} affixed />

                <Row>
                    <Col md={4}>
                        <strong>{getTaskDisplayName(this.props.entry.task)}</strong>
                    </Col>
                    <Col md={5}>
                        Started <RelativeTime time={this.props.entry.created_at} /> by {this.props.entry.user.id}
                    </Col>
                    <Col md={3}>
                        {icon}
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state, props) => ({
    entry: get(state, `jobs.documents[${props.index}]`, null)
});

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

export default connect(mapStateToProps, mapDispatchToProps)(JobEntry);
