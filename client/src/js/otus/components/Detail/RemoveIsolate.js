import { get } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import { RemoveModal } from "../../../base";
import { hideOTUModal, removeIsolate } from "../../actions";

export const RemoveIsolate = ({ id, name, nextId, otuId, show, onConfirm, onHide }) => {
    const handleConfirm = useCallback(() => {
        onConfirm(otuId, id, nextId);
    }, [otuId, id]);

    return <RemoveModal name={name} noun="Isolate" onConfirm={handleConfirm} onHide={onHide} show={show} />;
};

export const mapStateToProps = state => {
    const { id, name } = state.otus.activeIsolate;
    return {
        id,
        name,
        nextId: get(state, ["otus", "detail", "isolates", 0, "id"], null),
        otuId: state.otus.detail.id,
        show: state.otus.removeIsolate
    };
};

export const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(hideOTUModal());
    },

    onConfirm: (otuId, isolateId, nextIsolateId) => {
        dispatch(removeIsolate(otuId, isolateId, nextIsolateId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(RemoveIsolate);
