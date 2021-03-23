import React, { useCallback } from "react";
import { connect } from "react-redux";
import { RemoveBanner } from "../../../base";
import { removeReference } from "../../actions";
import { checkReferenceRight } from "../../selectors";

export const RemoveReference = ({ canRemove, id, onConfirm }) => {
    const handleClick = useCallback(() => onConfirm(id), ["id"]);

    if (canRemove) {
        return <RemoveBanner message="Permanently delete this reference" buttonText="Delete" onClick={handleClick} />;
    }

    return null;
};

export const mapStateToProps = state => ({
    id: state.references.detail.id,
    canRemove: checkReferenceRight(state, "remove")
});

export const mapDispatchToProps = dispatch => ({
    onConfirm: refId => {
        dispatch(removeReference(refId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(RemoveReference);
