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
import Request from "superagent";
import { Modal } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";


export default class LostConnection extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            checking: false
        };
    }

    static propTypes = {
        show: React.PropTypes.bool.isRequired
    };

    componentWillReceiveProps (nextProps) {
        if (nextProps.show) {
            const host = dispatcher.settings.get("server_host");
            const port = dispatcher.settings.get("server_port");
            const protocol = dispatcher.settings.get("use_ssl") ? "https": "http";

            const address = `${protocol}://${host}:${port}`;

            this.interval = window.setInterval(() => this.checkConnection(address), 3000);
        }
    }

    checkConnection = (address) => {
        Request.get(address).end((err) => {
            if (err) {
                console.warn("Couldn't reach server. Trying again in 3 seconds");
            } else {
                window.clearInterval(this.interval);
                window.location.assign(address);
            }
        });
    };

    render () {
        return (
            <Modal show={this.props.show} animation={false} bsSize="small">
                <Modal.Body className="text-center">
                    <h5><Icon name="warning" bsStyle="danger" /> Lost Connection</h5>
                    <small className="text-muted">Will reconnect automatically</small>
                </Modal.Body>
            </Modal>
        );
    }

}
