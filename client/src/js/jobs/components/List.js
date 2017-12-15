/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { ListGroup, ListGroupItem, Pagination } from "react-bootstrap";

import { findJobs, cancelJob, removeJob } from "../actions";
import { Flex, FlexItem, Icon, ViewHeader } from "../../base";
import Job from "./Entry";
import JobsToolbar from "./Toolbar";

class JobsList extends React.Component {

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

    handlePage = (page) => {
        const url = new window.URL(window.location);
        url.searchParams.set("page", page);
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
                <ViewHeader
                    title="Jobs"
                    page={this.props.page}
                    count={this.props.documents.length}
                    foundCount={this.props.foundCount}
                    totalCount={this.props.totalCount}
                />

                <JobsToolbar value={term} onChange={this.handleChange} />

                <ListGroup>
                    {components}
                </ListGroup>

                {this.props.documents.length ? (
                    <div className="text-center">
                        <Pagination
                            items={this.props.pageCount}
                            maxButtons={10}
                            activePage={this.props.page}
                            onSelect={this.handlePage}
                            first
                            last
                            next
                            prev
                        />
                    </div>
                ): null}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {...state.jobs};
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFind: (url = new window.URL(window.location)) => {
            dispatch(push(url.pathname + url.search));
            dispatch(findJobs(url.searchParams.get("find"), url.searchParams.get("page") || 1));
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
