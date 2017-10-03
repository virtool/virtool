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
import { toNumber } from "lodash";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSetting } from "../../actions";
import { Icon, InputSave } from "../../../components/Base";

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
                        label="Host"
                        autoComplete={false}
                        onSave={e => props.onUpdateHost(e.value)}
                        initialValue={props.host}
                    />
                    <InputSave
                        label="Port"
                        type="number"
                        autoComplete={false}
                        onSave={e => props.onUpdatePort(e.value)}
                        initialValue={props.port}
                    />
                </Panel>
            </Col>
        </Row>
    );
};

const mapStateToProps = (state) => {
    return {
        host: state.settings.data.server_host,
        port: state.settings.data.server_port
    }
};

const mapDispatchToProps = (dispatch) => {
    return {
        onUpdateHost: (value) => {
            dispatch(updateSetting("server_host", value));
        },

        onUpdatePort: (value) => {
            dispatch(updateSetting("server_port", toNumber(value)));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(HTTPOptions);

export default Container;
