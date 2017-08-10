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

import { getIndexHistory } from "../actions";

class IndexChanges extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        match: PropTypes.object,
        detail: PropTypes.object,
        history: PropTypes.object,
        onGet: PropTypes.func
    };

    componentWillMount () {
        this.props.onGet(this.props.match.params.indexVersion);
    }

    render () {

        if (this.props.history === null || this.props.detail === null) {
            return <div />;
        }

        const detail = this.props.detail;
        const history = this.props.history;

        return (
            <div>History - Yes</div>
        );
    }
}

IndexChanges.propTypes = {
    detail: PropTypes.object
};

const mapStateToProps = (state) => {
    return {
        detail: state.indexes.detail,
        history: state.indexes.history
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: (indexVersion) => {
            dispatch(getIndexHistory(indexVersion));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IndexChanges);

export default Container;
