/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import PropTypes from "prop-types";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { ListGroup, ListGroupItem } from "react-bootstrap";

import { findJobs, cancelJob, removeJob } from "../actions";
import { Flex, FlexItem, Icon } from "../../base";
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

    handleChange = (term) => {
        const url = new window.URL(window.location);

        if (term) {
            url.searchParams.set("find", term);
        } else {
            url.searchParams.delete("find")
        }

        this.props.onFind(url);
    };

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

        const url = new window.URL(window.location);

        const term = url.searchParams.get("find") || "";

        return (
            <div>
                <h3 className="view-header">
                    <strong>Jobs</strong>
                </h3>

                <JobsToolbar value={term} onChange={this.handleChange} />

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
        onFind: (url = new window.URL(window.location)) => {
            dispatch(push(url.pathname + url.search));
            dispatch(findJobs(url.searchParams.get("term"), url.searchParams.get("page") || 1));
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
