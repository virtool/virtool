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

import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { removeIsolate, hideVirusModal } from "../../actions";
import { Button } from "../../../base";

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
                onClick={() => props.onConfirm(props.virusId, props.isolateId, props.nextIsolateId)}
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
    nextIsolateId: PropTypes.string,
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

        onConfirm: (virusId, isolateId, nextIsolateId) => {
            dispatch(removeIsolate(virusId, isolateId, nextIsolateId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveIsolate);

export default Container;
