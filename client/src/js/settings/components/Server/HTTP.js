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
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSettings } from "../../actions";
import { Icon, InputSave } from "virtool/js/components/Base";

const HTTPOptions = (props) => {

    const footer = (
        <small className="text-warning">
            <Icon name="warning" /> Changes to these settings will only take effect when the server is reloaded.
        </small>
    );

    return (
        <Row>
            <Col xs={12}>
                <h5><strong>HTTP Server</strong></h5>
            </Col>
            <Col xs={12} md={6} mdPush={6}>
                <Panel footer={footer}>
                    Change the address and port the the web server listens on.
                </Panel>
            </Col>
            <Col xs={12} md={6} mdPull={6}>
                <Panel>
                    <InputSave
                        name="server_host"
                        label="Host"
                        autoComplete={false}
                        onSave={e => props.onChangeHost(e.value)}
                        initialValue={props.host}
                    />
                    <InputSave
                        name="server_port"
                        label="Port"
                        type="number"
                        autoComplete={false}
                        onSave={event => props.onChangePort("server_port", event.value)}
                        initialValue={props.port}
                    />
                </Panel>
            </Col>
        </Row>
    );
};

HTTPOptions.propTypes = {
    host: React.PropTypes.string,
    port: React.PropTypes.number,
    onChangeHost: React.PropTypes.func,
    onChangePort: React.PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        host: state.settings.data.server_host,
        port: state.settings.data.server_port
    }
};

const mapDispatchToProps = (dispatch) => {
    return {
        onChangeHost: (host) => {
            dispatch(updateSettings({server_host: host}));
        },

        onChangePort: (port) => {
            dispatch(updateSettings({server_port: Number(port)}));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(HTTPOptions);

export default Container;
