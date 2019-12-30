import React from "react";
import { connect } from "react-redux";
import { push } from "connected-react-router";
import { routerLocationHasState } from "../../utils/utils";
import { removeSample } from "../actions";
import { RemoveModal } from "../../base";

export const RemoveSample = ({ id, name, show, onHide, onConfirm }) => (
    <RemoveModal noun="Sample" name={name} show={show} onConfirm={() => onConfirm(id)} onHide={onHide} />
);

const mapStateToProps = state => {
    const { id, name } = state.samples.detail;
    return {
        show: routerLocationHasState(state, "removeSample"),
        id,
        name
    };
};

const mapDispatchToProps = dispatch => ({
    onConfirm: sampleId => {
        dispatch(removeSample(sampleId));
    },
    onHide: () => {
        dispatch(push({ state: { removeSample: false } }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(RemoveSample);
