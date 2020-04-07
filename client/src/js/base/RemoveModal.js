import React from "react";
import PropTypes from "prop-types";
import { DialogBody, ModalDialog, DialogFooter } from "./Modal";
import { Button } from "./Button";

/**
 * A modal that requests confirmation from the user for deleting a document or other sensitive information.
 *
 * @func
 * @param name {string} the display name for the item to be removed (eg. Baminivirus)
 * @param noun {string} the type of document being removed (eg. otu)
 * @param show {boolean} toggle visibility of the modal
 * @param onConfirm {function} a function to call on confirmation
 * @param onHide {function} a function that hides the modal
 */
export const RemoveModal = ({ name, noun, show, onConfirm, onHide, message }) => {
    const headerText = "Remove ".concat(noun);
    return (
        <ModalDialog label="Remove" headerText={headerText} show={show} onHide={onHide} modalStyle="danger">
            <DialogBody>
                {message || (
                    <span>
                        Are you sure you want to remove <strong>{name}</strong>?
                    </span>
                )}
            </DialogBody>
            <DialogFooter style={{ border: "none" }}>
                <Button color="red" icon="check" onClick={onConfirm}>
                    Confirm
                </Button>
            </DialogFooter>
        </ModalDialog>
    );
};

RemoveModal.propTypes = {
    noun: PropTypes.string,
    name: PropTypes.string,
    show: PropTypes.bool,
    onHide: PropTypes.func,
    onConfirm: PropTypes.func,
    message: PropTypes.node
};
