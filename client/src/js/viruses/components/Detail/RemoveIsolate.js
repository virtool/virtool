/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveIsolate
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { removeIsolate, hideVirusModal } from "../../actions";
import { Button } from "virtool/js/components/Base";

const RemoveIsolate = (props) => (
    <Modal show={props.show} onHide={props.onHide} dialogClassName="modal-danger">
        <Modal.Header onHide={props.onHide} closeButton>
            Remove Isolate
        </Modal.Header>
        <Modal.Body>
            Are you sure you want to remove <strong>{props.isolateName}</strong>?
        </Modal.Body>
        <Modal.Footer>
            <Button
                bsStyle="danger"
                icon="checkmark"
                onClick={() => props.onConfirm(props.virusId, props.isolateId, props.onSuccess)}
            >
                Confirm
            </Button>
        </Modal.Footer>
    </Modal>
);

RemoveIsolate.propTypes = {
    virusId: PropTypes.string,
    isolateId: PropTypes.string,
    isolateName: PropTypes.string,
    show: PropTypes.bool,
    onHide: PropTypes.func,
    onConfirm: PropTypes.func,
    onSuccess: PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        show: state.viruses.removeIsolate
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onHide: () => {
            dispatch(hideVirusModal());
        },

        onConfirm: (virusId, isolateId, onSuccess) => {
            dispatch(removeIsolate(virusId, isolateId, onSuccess));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveIsolate);

export default Container;
