/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports LostConnection
 */

import React from "react";
import { Modal } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";

export default class LostConnection extends React.Component {

    static propTypes = {
        show: React.PropTypes.bool.isRequired
    };

    render () {
        return (
            <Modal show={this.props.show} animation={false} bsSize="small">
                <Modal.Body className="text-center">
                    <h5><Icon name="warning" bsStyle="danger" /> Lost Connection</h5>
                </Modal.Body>
            </Modal>
        );
    }

}
