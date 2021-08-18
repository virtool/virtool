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
    ViewHeader,
    ViewHeaderAttribution,
    ViewHeaderIcons,
    ViewHeaderTitle
} from "../../base";
import { getWorkflowDisplayName } from "../../utils/utils";
import { getJob, removeJob } from "../actions";
import JobError from "./Error";
import JobSteps from "./Steps";
import { JobArgs } from "./JobArgs";

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

        const workflow = getWorkflowDisplayName(detail.workflow);

        return (
            <div>
                <ViewHeader title={workflow}>
                    <ViewHeaderTitle>
                        {workflow} <JobDetailBadge color={color}>{latest.state}</JobDetailBadge>
                        <ViewHeaderIcons>
                            <Icon color="red" name="trash" style={{ fontSize: "18px" }} onClick={this.handleClick} />
                        </ViewHeaderIcons>
                    </ViewHeaderTitle>
                    <ViewHeaderAttribution time={detail.status[0].timestamp} user={detail.user.id} />
                </ViewHeader>

                <JobArgs workflow={detail.workflow} args={detail.args} />

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
