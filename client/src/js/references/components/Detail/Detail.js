import React from "react";
import { connect } from "react-redux";

import { getRef } from "../../actions";
import { LoadingPlaceholder } from "../../../base";

class RefDetail extends React.Component {

    componentDidMount () {
        this.props.getRef(this.props.match.params.refId);
    }

    render = () => {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        return <div>TesT</div>;
    };
}

const mapStateToProps = state => ({
    detail: state.refs.detail
});

const mapDispatchToProps = dispatch => ({

    getVirus: (refId) => {
        dispatch(getRef(refId));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(RefDetail);
