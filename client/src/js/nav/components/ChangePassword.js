/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ChangePassword
 */

import React from "react";
import { Modal } from "react-bootstrap";
import ChangePasswordForm from "./ChangePasswordForm";

const ChangePasswordModal = (props) => {

    const header = (
        <Modal.Header onHide={props.onHide} closeButton>
            Change Password
        </Modal.Header>
    );

    return (
        <Modal bsSize="small" show={props.show} onHide={props.onHide}>
            <ChangePasswordForm
                onReset={props.onHide}
                requireOld={true}
                header={header}
                bodyClass="modal-body"
                footerClass="modal-footer"
            />
        </Modal>
    );
};

ChangePasswordModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired
};

export default ChangePasswordModal;
