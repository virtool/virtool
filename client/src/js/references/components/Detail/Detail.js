import React from "react";
import { connect } from "react-redux";

import { getReference } from "../../actions";
import { LoadingPlaceholder } from "../../../base";

class ReferenceDetail extends React.Component {

    componentDidMount () {
        this.props.getReference(this.props.match.params.refId);
    }

    render = () => {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        return <div>Test</div>;
    };
}

const mapStateToProps = state => ({
    detail: state.refs.detail
});

const mapDispatchToProps = dispatch => ({

    getReference: (refId) => {
        dispatch(getReference(refId));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceDetail);
