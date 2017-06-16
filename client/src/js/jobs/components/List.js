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
import { ListGroup } from "react-bootstrap";

import { findJobs, cancelJob, removeJob } from "../actions";
import Job from "./Entry";
import JobsToolbar from "./Toolbar";

class JobsList extends React.Component {

    static propTypes = {
        history: PropTypes.object,
        documents: PropTypes.arrayOf(PropTypes.object),
        onFind: PropTypes.func,
        onCancel: PropTypes.func,
        onRemove: PropTypes.func
    };

    componentDidMount () {
        this.props.onFind();
    }

    render () {

        if (this.props.documents === null) {
            return <div />;
        }

        const components = this.props.documents.map(doc =>
            <Job
                key={doc.job_id}
                {...doc}
                cancel={this.props.onCancel}
                remove={this.props.onRemove}
                navigate={() => this.props.history.push(`/jobs/${doc.job_id}`)}
            />
        );

        return (
            <div>
                <JobsToolbar />
                <ListGroup>
                    {components}
                </ListGroup>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        documents: state.jobs.list
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFind: () => {
            dispatch(findJobs());
        },

        onCancel: (jobId) => {
            dispatch(cancelJob(jobId));
        },

        onRemove: (jobId) => {
            dispatch(removeJob(jobId))
        }
    };
};

const Container = connect(
    mapStateToProps,
    mapDispatchToProps
)(JobsList);

export default Container;
