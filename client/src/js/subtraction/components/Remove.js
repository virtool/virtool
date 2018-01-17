import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import { removeSubtraction } from "../actions";
import { RemoveModal } from "../../base";
import {routerLocationHasState} from "../../utils";

const RemoveSubtraction = ({ id, show, onHide, onConfirm }) => (
    <RemoveModal
        id={id}
        name={id}
        noun="Subtraction"
        show={show}
        onHide={onHide}
        onConfirm={() => onConfirm(id)}
    />
);

const mapStateToProps = (state) => ({
    show: routerLocationHasState(state, "removeSubtraction", true)
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

