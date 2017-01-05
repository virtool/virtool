/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HTTPOptions
 */

import React from "react";
import { Row, Col, Panel } from "react-bootstrap";
import { Icon, Input, InputSave } from "virtool/js/components/Base";

const HTTPOptions = (props) => {

    const footer = (
        <small className="text-warning">
            <Icon name="warning" /> Changes to these settings will only take effect when the server is reloaded.
        </small>
    );

    return (
        <div>
            <Row>
                <Col md={12}>
                    <h5><strong>HTTP Server</strong></h5>
                </Col>
            </Row>
            <Row>
                <Col md={6}>
                    <Panel>
                        <InputSave
                            name="server_address"
                            label="Address"
                            autoComplete={false}
                            onSave={event => props.set("server_host", event.value)}
                            initialValue={props.settings.server_address}
                        />
                        <InputSave
                            name="server_port"
                            label="Port"
                            type="number"
                            autoComplete={false}
                            onSave={event => props.set("server_port", event.value)}
                            initialValue={props.settings.server_port}
                        />
                        <Input
                            label="Server ID"
                            type="text"
                            autoComplete={false}
                            value={props.settings.server_id}
                            disabled
                        />
                    </Panel>
                </Col>
                <Col md={6}>
                    <Panel footer={footer}>
                        Change the address and port the the Virtool HTTP server listens on. The server ID uniquely
                        identifies the server to workstations that are connecting to multiple instances of Virtool
                        server.
                    </Panel>
                </Col>
            </Row>
        </div>
    );
};

HTTPOptions.propTypes = {
    set: React.PropTypes.func,
    settings: React.PropTypes.object,
};

export default HTTPOptions;
