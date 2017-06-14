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

import { findJobs } from "../actions";
import Job from "./Entry";
import JobsToolbar from "./Toolbar";

class JobsList extends React.Component {

    static propTypes = {
        documents: PropTypes.arrayOf(PropTypes.object),
        onFind: PropTypes.func
    };

    componentDidMount () {
        this.props.onFind();
    }

    render () {

        if (this.props.documents === null) {
            return <div />;
        }

        const components = this.props.documents.map(doc =>
            <Job key={doc.job_id} {...doc} />
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
        }
    };
};

const Container = connect(
    mapStateToProps,
    mapDispatchToProps
)(JobsList);

export default Container;
