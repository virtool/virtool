import React from "react";
import Moment from "moment";
import { connect } from "react-redux";
import { Table } from "react-bootstrap";
import { push } from "react-router-redux";
import { get } from "lodash-es";
import { getJob, removeJob } from "../actions";
import { getTaskDisplayName } from "../../utils";
import { Flex, FlexItem, Icon, LoadingPlaceholder, ProgressBar, ViewHeader, NotFound } from "../../base";
import TaskArgs from "./TaskArgs";
import JobError from "./Error";

const JobTable = ({id, mem, proc, status, user}) => (
    <Table bordered>
        <tbody>
            <tr>
                <th className="col-xs-4">Cores</th>
                <td className="col-xs-8">{proc}</td>
            </tr>
            <tr>
                <th>Memory</th>
                <td>{mem} GB</td>
            </tr>
            <tr>
                <th>Started By</th>
                <td>{user.id}</td>
            </tr>
            <tr>
                <th>Started At</th>
                <td>{Moment(status[0].timestamp).format("YY/MM/DD")}</td>
            </tr>
            <tr>
                <th>Unique ID</th>
                <td>{id}</td>
            </tr>
        </tbody>
    </Table>
);

class JobDetail extends React.Component {

    componentDidMount () {
        this.props.getDetail(this.props.match.params.jobId);
    }

    handleClick = () => {
        this.props.onRemove(this.props.detail.id);
    }

    render () {

        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const detail = this.props.detail;

        const latest = detail.status[detail.status.length - 1];

        let progressStyle = "primary";

        if (latest.state === "running") {
            progressStyle = "success";
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
                                <strong>
                                    {taskName}
                                </strong>
                                <FlexItem grow={1} pad={7}>
                                    <small className={`text-strong text-capitalize text-${progressStyle}`}>
                                        {latest.state}
                                    </small>
                                </FlexItem>
                            </Flex>
                        </FlexItem>

                        <Icon
                            bsStyle="danger"
                            name="trash"
                            style={{fontSize: "18px"}}
                            onClick={this.handleClick}
                        />
                    </Flex>
                </ViewHeader>

                <ProgressBar bsStyle={progressStyle} now={latest.progress * 100} />

                <JobError error={latest.error} />

                <JobTable {...detail} />

                <h4>
                    <strong>Task Arguments</strong>
                </h4>

                <TaskArgs taskType={detail.task} taskArgs={detail.args} />

            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    error: get(state, "errors.GET_JOB_ERROR", null),
    detail: state.jobs.detail
});

const mapDispatchToProps = (dispatch) => ({

    getDetail: (jobId) => {
        dispatch(getJob(jobId));
    },

    onRemove: (jobId) => {
        dispatch(removeJob(jobId));
        dispatch(push("/jobs"));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(JobDetail);
