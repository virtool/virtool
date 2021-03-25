import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";
import { RemoveModal } from "../../../base";
import { routerLocationHasState } from "../../../utils/utils";
import { removeSample } from "../../actions";

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
        dispatch(pushState({ removeSample: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(RemoveSample);
