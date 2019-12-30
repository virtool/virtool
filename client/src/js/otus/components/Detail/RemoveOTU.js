import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { removeOTU, hideOTUModal } from "../../actions";
import { RemoveModal } from "../../../base";

export const RemoveOTU = ({ history, id, name, refId, show, onConfirm, onHide }) => {
    const handleConfirm = useCallback(() => {
        onConfirm(refId, id, history);
    }, [id, refId]);

    return <RemoveModal name={name} noun="OTU" onConfirm={handleConfirm} onHide={onHide} show={show} />;
};

RemoveOTU.propTypes = {
    history: PropTypes.object,
    id: PropTypes.string,
    name: PropTypes.string,
    refId: PropTypes.string,
    show: PropTypes.bool,
    onConfirm: PropTypes.func,
    onHide: PropTypes.func
};

export const mapStateToProps = state => ({
    show: state.otus.remove,
    refId: state.references.detail.id
});

export const mapDispatchToProps = dispatch => ({
    onConfirm: (refId, otuId, history) => {
        dispatch(removeOTU(refId, otuId, history));
    },

    onHide: () => {
        dispatch(hideOTUModal());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(RemoveOTU);
