import React from "react";
import { connect } from "react-redux";
import { push } from "connected-react-router";
import { removeSubtraction } from "../actions";
import { RemoveModal } from "../../base";
import { routerLocationHasState } from "../../utils/utils";

export const RemoveSubtraction = ({ id, show, onConfirm, onHide }) => (
    <RemoveModal id={id} name={id} noun="Subtraction" show={show} onHide={onHide} onConfirm={() => onConfirm(id)} />
);

export const mapStateToProps = state => ({
    show: routerLocationHasState(state, "removeSubtraction", true)
});

export const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(push({ state: { removeSubtraction: false } }));
    },

    onConfirm: subtractionId => {
        dispatch(removeSubtraction(subtractionId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(RemoveSubtraction);
