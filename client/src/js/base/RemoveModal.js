import React from "react";
import PropTypes from "prop-types";
import { Modal } from "react-bootstrap";

import { Button } from "./Button";

export const RemoveModal = ({ name, noun, show, onConfirm, onHide }) => (
    <Modal show={show} onHide={onHide} dialogClassName="modal-danger">
        <Modal.Header onHide={onHide} closeButton>
            Remove {noun}
        </Modal.Header>
        <Modal.Body>
            Are you sure you want to remove <strong>{name}</strong>?
        </Modal.Body>
        <Modal.Footer>
            <Button bsStyle="danger" icon="checkmark" onClick={onConfirm}>
                Confirm
            </Button>
        </Modal.Footer>
    </Modal>
);

RemoveModal.propTypes = {
    noun: PropTypes.string,
    name: PropTypes.string,
    show: PropTypes.bool,
    onHide: PropTypes.func,
    onConfirm: PropTypes.func
};
