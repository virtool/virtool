/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";

import { getJob } from "../actions";
import { getTaskDisplayName } from "../../utils";
import { Icon, Flex, FlexItem } from "virtool/js/components/Base";


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

        const state = detail.status[detail.status.length - 1].state;

        return (
            <div>
                <h3 style={{marginBottom: "20px"}}>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <Flex alignItems="center">
                                <strong>
                                    {getTaskDisplayName(detail.task)}
                                </strong>
                                <FlexItem grow={1} pad={5}>
                                    <small className="text-uppercase text-strong">
                                        {detail.job_id}
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
