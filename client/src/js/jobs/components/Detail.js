import { push } from "connected-react-router";
import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    Badge,
    Icon,
    LoadingPlaceholder,
    NotFound,
    Table,
    ViewHeader,
    ViewHeaderAttribution,
    ViewHeaderIcons,
    ViewHeaderTitle
} from "../../base";
import { getTaskDisplayName } from "../../utils/utils";
import { getJob, removeJob } from "../actions";
import JobError from "./Error";
import JobSteps from "./Steps";
import TaskArgs from "./TaskArgs";

const JobDetailBadge = styled(Badge)`
    text-transform: capitalize;
`;

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

        let color = "green";

        if (latest.state === "running") {
            color = "blue";
        }

        if (latest.state === "error" || latest.state === "cancelled") {
            color = "red";
        }

        const taskName = getTaskDisplayName(detail.task);

        return (
            <div>
                <ViewHeader title={taskName}>
                    <ViewHeaderTitle>
                        <span>
                            {taskName} <JobDetailBadge color={color}>{latest.state}</JobDetailBadge>
                        </span>
                        <ViewHeaderIcons>
                            <Icon color="red" name="trash" style={{ fontSize: "18px" }} onClick={this.handleClick} />
                        </ViewHeaderIcons>
                    </ViewHeaderTitle>
                    <ViewHeaderAttribution time={detail.status[0].timestamp} userId={detail.user.id} />
                </ViewHeader>

                <Table>
                    <tbody>
                        <tr>
                            <th>Cores / Memory</th>
                            <td>
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

export default connect(mapStateToProps, mapDispatchToProps)(JobDetail);
