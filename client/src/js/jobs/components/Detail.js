/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import Moment from "moment";
import { capitalize } from "lodash";
import { connect } from "react-redux";
import { Table } from "react-bootstrap";

import { getJob } from "../actions";
import { getTaskDisplayName } from "../../utils";
import { Flex, FlexItem, Icon, ProgressBar } from "virtool/js/components/Base";
import TaskArgs from "./TaskArgs";


class JobDetail extends React.Component {

    static propTypes = {
        match: PropTypes.object,
        detail: PropTypes.object,
        getDetail: PropTypes.func
    };

    componentDidMount () {
        this.props.getDetail(this.props.match.params.jobId);
    }

    render () {

        if (this.props.detail === null) {
            return <div />;
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

        console.log(detail);

        return (
            <div>
                <h3 style={{marginBottom: "20px"}}>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <Flex alignItems="center">
                                <strong>
                                    {getTaskDisplayName(detail.task)}
                                </strong>
                                <FlexItem grow={1} pad={7}>
                                    <small className={`text-strong text-${progressStyle}`}>
                                        {capitalize(latest.state)}
                                    </small>
                                </FlexItem>
                            </Flex>
                        </FlexItem>

                        <Icon
                            bsStyle="danger"
                            name="remove"
                            style={{fontSize: "18px"}}
                            onClick={() => console.log(detail.job_id)}
                        />
                    </Flex>
                </h3>

                <ProgressBar bsStyle={progressStyle} now={latest.progress * 100} />

                <Table bordered>
                    <tbody>
                        <tr>
                            <th>Cores</th>
                            <td>{detail.proc}</td>
                        </tr>
                        <tr>
                            <th>Memory</th>
                            <td>{detail.mem} GB</td>
                        </tr>
                        <tr>
                            <th>Started By</th>
                            <td>{detail.user_id}</td>
                        </tr>
                        <tr>
                            <th>Started At</th>
                            <td>{Moment(detail.status[0].timestamp).format("YY/MM/DD")}</td>
                        </tr>
                        <tr>
                            <th>Unique ID</th>
                            <td className="text-uppercase">{detail.job_id}</td>
                        </tr>
                    </tbody>
                </Table>

                <h4>
                    <strong>Task Arguments</strong>
                </h4>

                <TaskArgs taskType={detail.task} taskArgs={detail.args} />

            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        detail: state.jobs.detail
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getDetail: (jobId) => {
            dispatch(getJob(jobId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(JobDetail);

export default Container;
