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

import { getIndex } from "../actions";

class IndexDetail extends React.Component {

    componentDidMount () {
        this.props.onGet(this.props.match.params.indexVersion);
    }

    static propTypes = {
        match: PropTypes.object,
        detail: PropTypes.object,
        onGet: PropTypes.func
    };

    render () {

        if (this.props.detail === null) {
            return <div />;
        }

        console.log(this.props.detail);

        return (
            <div>
                <h3 className="view-header">
                    <strong>Virus Index {this.props.detail.index_version}</strong>
                </h3>
            </div>
        );
    }

}

const mapStateToProps = (state) => {
    return {
        detail: state.indexes.detail
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: (indexVersion) => {
            console.log(indexVersion);
            dispatch(getIndex(indexVersion));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IndexDetail);

export default Container;
