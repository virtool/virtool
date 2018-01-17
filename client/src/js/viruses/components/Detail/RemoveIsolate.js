import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";

import { removeIsolate, hideVirusModal } from "../../actions";
import { RemoveModal } from "../../../base";

const RemoveIsolate = ({ isolateId, isolateName, nextIsolateId, onConfirm, onHide, show, virusId}) => (
    <RemoveModal
        name={isolateName}
        noun="isolate"
        onConfirm={() => onConfirm(virusId, isolateId, nextIsolateId)}
        onHide={onHide}
        show={show}
    />
);

RemoveIsolate.propTypes = {
    virusId: PropTypes.string,
    isolateId: PropTypes.string,
    isolateName: PropTypes.string,
    nextIsolateId: PropTypes.string,
    show: PropTypes.bool,
    onHide: PropTypes.func,
    onConfirm: PropTypes.func,
    onSuccess: PropTypes.func
};

const mapStateToProps = state => ({
    show: state.viruses.removeIsolate
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideVirusModal());
    },

    onConfirm: (virusId, isolateId, nextIsolateId) => {
        dispatch(removeIsolate(virusId, isolateId, nextIsolateId));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveIsolate);

export default Container;
