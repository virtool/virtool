import React from "react";
import PropTypes from "prop-types";
import { capitalize, get } from "lodash-es";
import { Row, Col } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { ClipLoader } from "halogenium";
import { Icon, RelativeTime, ProgressBar, Flex, FlexItem } from "../../base";
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

        let actionIcon;
        let statusIcon;

        if ((this.props.entry.state === "waiting" || this.props.entry.state === "running")
            && this.props.canCancel) {
            actionIcon = (
                <Icon
                    bsStyle="danger"
                    name="ban"
                    onClick={this.handleCancel}
                    pullRight
                />
            );

            statusIcon = <ClipLoader size="14px" color="#3c8786" />;
        } else if (this.props.canRemove) {
            actionIcon = (
                <Icon
                    bsStyle="danger"
                    name="trash"
                    onClick={this.handleRemove}
                    pullRight
                />
            );
            
            statusIcon = this.props.entry.state === "complete"
                ? (<Icon name="check" bsStyle="success" />)
                : (<Icon name="times" bsStyle="danger" />);
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
                <ProgressBar now={progressValue} bsStyle={progressStyle} affixed />

                <Row>
                    <Col xs={4} md={4}>
                        <strong>{getTaskDisplayName(this.props.entry.task)}</strong>
                    </Col>
                    <Col xs={5} md={5}>
                        Started <RelativeTime time={this.props.entry.created_at} /> by {this.props.entry.user.id}
                    </Col>
                    <Col xs={2} md={2}>
                        <Flex justifyContent="flex-end">
                            <FlexItem>
                                {statusIcon}
                            </FlexItem>
                            <FlexItem pad>
                                <strong>
                                    {capitalize(this.props.entry.state)}
                                </strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col xs={1} md={1}>
                        {actionIcon || null}
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
