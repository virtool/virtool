import React from "react";
import { connect } from "react-redux";
import { RemoveBanner } from "../../../base";
import { removeReference } from "../../actions";

const RemoveReference = ({ id, onConfirm }) => (
    <RemoveBanner
        message="Click the Delete button to permanently remove this reference."
        buttonText="Delete"
        onClick={() => onConfirm(id)}
    />
);

const mapStateToProps = state => ({
    id: state.references.detail.id
});

const mapDispatchToProps = dispatch => ({
    onConfirm: refId => {
        dispatch(removeReference(refId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(RemoveReference);
