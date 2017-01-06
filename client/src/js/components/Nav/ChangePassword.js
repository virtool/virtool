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
import { Icon, Button } from "virtool/js/components/Base";
import ChangePassword from "virtool/js/components/Login/Change";

export default class ChangePasswordModal extends React.Component {

    static propTypes = {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    };

    render () {

        const footer = (
            <Modal.Footer>
                <Button bsStyle="primary" type="submit">
                    <Icon name="floppy" /> Save
                </Button>
            </Modal.Footer>
        );

        return (
            <Modal bsSize="small" show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Change Password
                </Modal.Header>

                <ChangePassword
                    onSuccess={this.props.onHide}
                    requireOld={true}
                    footer={footer}
                    containerClass="modal-body"
                />
            </Modal>
        );
    }
}
