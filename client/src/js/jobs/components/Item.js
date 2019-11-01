import React from "react";
import PropTypes from "prop-types";
import { capitalize } from "lodash-es";
import { Row, Col } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "connected-react-router";
import { RelativeTime, ProgressBar, Flex, FlexItem } from "../../base";
import { getTaskDisplayName } from "../../utils/utils";
import { cancelJob, removeJob } from "../actions";
import { JobActionIcon, JobStatusIcon } from "./Icons";

export class JobItem extends React.Component {
    static propTypes = {
        id: PropTypes.string.isRequired,
        task: PropTypes.string.isRequired,
        state: PropTypes.string.isRequired,
        progress: PropTypes.number.isRequired,
        created_at: PropTypes.string.isRequired,
        user: PropTypes.object.isRequired,
        onNavigate: PropTypes.func,
        onCancel: PropTypes.func,
        onRemove: PropTypes.func,
        canRemove: PropTypes.bool,
        canCancel: PropTypes.bool
    };

    handleCancel = e => {
        e.stopPropagation();
        this.props.onCancel(this.props.id);
    };

    handleNavigate = e => {
        e.stopPropagation();
        this.props.onNavigate(this.props.id);
    };

    handleRemove = e => {
        e.stopPropagation();
        this.props.onRemove(this.props.id);
    };

    render() {
        let progressStyle = "success";

        const progressValue = this.props.progress * 100;

        if (this.props.state === "running") {
            progressStyle = "warning";
        }

        if (this.props.state === "error" || this.props.state === "cancelled") {
            progressStyle = "danger";
        }

        // Create the option components for the selected fields.
        return (
            <div
                className="list-group-item hoverable spaced job"
                onClick={this.handleNavigate}
                style={{ color: "#555" }}
            >
                <ProgressBar now={progressValue} bsStyle={progressStyle} affixed />

                <Row>
                    <Col xs={6} sm={4} md={4}>
                        <strong>{getTaskDisplayName(this.props.task)}</strong>
                    </Col>
                    <Col xs={5} sm={5} md={5}>
                        Started <RelativeTime time={this.props.created_at} /> by {this.props.user.id}
                    </Col>
                    <Col xsHidden sm={2} md={2}>
                        <Flex justifyContent="flex-end">
                            <FlexItem>
                                <JobStatusIcon state={this.props.state} />
                            </FlexItem>
                            <FlexItem pad>
                                <strong>{capitalize(this.props.state)}</strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col xs={1} sm={1} md={1}>
                        <JobActionIcon
                            state={this.props.state}
                            canCancel={this.props.canCancel}
                            canRemove={this.props.canRemove}
                            onCancel={this.onCancel}
                            onRemove={this.onRemove}
                        />
                    </Col>
                </Row>
            </div>
        );
    }
}

export const mapDispatchToProps = dispatch => ({
    onCancel: jobId => {
        dispatch(cancelJob(jobId));
    },

    onNavigate: jobId => {
        dispatch(push(`/jobs/${jobId}`));
    },

    onRemove: jobId => {
        dispatch(removeJob(jobId));
    }
});

export default connect(
    null,
    mapDispatchToProps
)(JobItem);
