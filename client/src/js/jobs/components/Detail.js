import React from "react";
import { connect } from "react-redux";
import { push } from "connected-react-router";
import { Table } from "react-bootstrap";
import { get } from "lodash-es";
import { getJob, removeJob } from "../actions";
import { getTaskDisplayName } from "../../utils/utils";
import { Flex, FlexItem, Icon, LoadingPlaceholder, ViewHeader, NotFound, RelativeTime } from "../../base";
import TaskArgs from "./TaskArgs";
import JobError from "./Error";
import JobSteps from "./Steps";

class JobDetail extends React.Component {
    componentDidMount() {
        this.props.getDetail(this.props.match.params.jobId);
    }

    handleClick = () => {
        this.props.onRemove(this.props.detail.id);
    };

    render() {
        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const detail = this.props.detail;

        const latest = detail.status[detail.status.length - 1];

        let progressStyle = "success";

        if (latest.state === "running") {
            progressStyle = "primary";
        }

        if (latest.state === "error" || latest.state === "cancelled") {
            progressStyle = "danger";
        }

        const taskName = getTaskDisplayName(detail.task);

        return (
            <div>
                <ViewHeader title={`${taskName} - Jobs`}>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <Flex alignItems="center">
                                <strong>{taskName}</strong>
                                <FlexItem grow={1} pad={7}>
                                    <small className={`text-strong text-capitalize text-${progressStyle}`}>
                                        {latest.state}
                                    </small>
                                </FlexItem>
                            </Flex>
                        </FlexItem>

                        <Icon bsStyle="danger" name="trash" style={{ fontSize: "18px" }} onClick={this.handleClick} />
                    </Flex>
                    <div className="text-muted" style={{ fontSize: "12px" }}>
                        Started <RelativeTime time={detail.status[0].timestamp} /> by {detail.user.id}
                    </div>
                </ViewHeader>

                <Table bordered>
                    <tbody>
                        <tr>
                            <th className="col-xs-4">Cores / Memory</th>
                            <td className="col-xs-8">
                                {detail.proc} CPUs / {detail.mem} GB
                            </td>
                        </tr>
                    </tbody>
                </Table>

                <h4>
                    <strong>Task Arguments</strong>
                </h4>

                <TaskArgs taskType={detail.task} taskArgs={detail.args} />

                <JobSteps />

                <JobError error={latest.error} />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    error: get(state, "errors.GET_JOB_ERROR", null),
    detail: state.jobs.detail
});

const mapDispatchToProps = dispatch => ({
    getDetail: jobId => {
        dispatch(getJob(jobId));
    },

    onRemove: jobId => {
        dispatch(removeJob(jobId));
        dispatch(push("/jobs"));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(JobDetail);
