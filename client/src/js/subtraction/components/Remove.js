import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import { removeSubtraction } from "../actions";
import { RemoveModal } from "../../base";

const RemoveSubtraction = ({ id, show, onHide, onConfirm }) => (
    <RemoveModal
        id={id}
        name={id}
        noun="Subtraction"
        show={show}
        onHide={onHide}
        onConfirm={onConfirm}
    />
);

const mapStateToProps = (state) => ({
    show: !!state.router.location.state && state.router.location.state.removeSubtraction
});

const mapDispatchToProps = (dispatch) => ({

    onHide: () => {
        dispatch(push({state: {removeSubtraction: false}}));
    },

    onConfirm: (subtractionId) => {
        dispatch(removeSubtraction(subtractionId));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveSubtraction);

export default Container;

