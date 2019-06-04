import React, { useCallback } from "react";
import { connect } from "react-redux";
import { RemoveBanner } from "../../../base";
import { checkRefRight } from "../../../utils/utils";
import { removeReference } from "../../actions";

export const RemoveReference = ({ canRemove, id, onConfirm }) => {
    const handleClick = useCallback(() => onConfirm(id), ["id"]);

    if (canRemove) {
        return (
            <RemoveBanner
                message="Click the Delete button to permanently remove this reference."
                buttonText="Delete"
                onClick={handleClick}
            />
        );
    }

    return null;
};

export const mapStateToProps = state => ({
    id: state.references.detail.id,
    canRemove: checkRefRight(state, "remove")
});

export const mapDispatchToProps = dispatch => ({
    onConfirm: refId => {
        dispatch(removeReference(refId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(RemoveReference);
