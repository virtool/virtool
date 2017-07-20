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
import { ListGroup, ListGroupItem } from "react-bootstrap";

import { findJobs, cancelJob, removeJob } from "../actions";
import { Flex, FlexItem, Icon } from "virtool/js/components/Base";
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

        let components = this.props.documents.map(doc =>
            <Job
                key={doc.id}
                {...doc}
                cancel={this.props.onCancel}
                remove={this.props.onRemove}
                navigate={() => this.props.history.push(`/jobs/${doc.id}`)}
            />
        );

        if (!components.length) {
            components = (
                <ListGroupItem>
                    <Flex justifyContent="center" alignItems="center">
                        <Icon name="info" />
                        <FlexItem pad={5}>
                            No Jobs Found
                        </FlexItem>
                    </Flex>
                </ListGroupItem>
            )
        }

        return (
            <div>
                <h3 className="view-header">
                    <strong>Jobs</strong>
                </h3>

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
        documents: state.jobs.documents
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
