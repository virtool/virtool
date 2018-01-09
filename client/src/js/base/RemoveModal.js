import React from "react";
import PropTypes from "prop-types";
import { Modal } from "react-bootstrap";

import { Button } from "./Button";

/**
 * A modal that requests confirmation from the user for deleting a document or other sensitive information.
 *
 * @func
 * @param name {string} the display name for the item to be removed (eg. Baminivirus)
 * @param noun {string} the type of document being removed (eg. virus)
 * @param show {boolean} toggle visibility of the modal
 * @param onConfirm {function} a function to call on confirmation
 * @param onHide {function} a function that hides the modal
 */
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
