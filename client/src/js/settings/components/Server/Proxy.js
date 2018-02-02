import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSetting } from "../../actions";
import { Checkbox, Icon, InputSave } from "../../../base";

const ProxyFooter = () => (
    <small className="text-danger">
        <Icon name="warning" /> Proxy authentication is stored in plain text in the settings file.
    </small>
);

const ProxyOptions = (props) => (
    <Row>
        <Col xs={12}>
            <h5><strong>Proxy</strong></h5>
        </Col>
        <Col xs={12} md={6} mdPush={6}>
            <Panel footer={<ProxyFooter />}>
                Configure the Virtool server to use a proxy server for outgoing requests.
            </Panel>
        </Col>
        <Col xs={12} md={6} mdPull={6}>
            <Panel>
                <InputSave
                    label="Address"
                    autoComplete={false}
                    onSave={props.onUpdateAddress}
                    initialValue={props.host}
                />
                <InputSave
                    label="Username"
                    autoComplete={false}
                    onSave={props.onUpdateUsername}
                    initialValue={props.username}
                />
                <InputSave
                    label="Password"
                    type="password"
                    autoComplete={false}
                    onSave={props.onUpdatePassword}
                    initialValue={props.password}
                />
                <Checkbox
                    label="Trust Environment Variables"
                    checked={props.trust}
                    onClick={() => props.onUpdateTrust(!props.trust)}
                />
            </Panel>
        </Col>
    </Row>
);

const mapStateToProps = (state) => {
    const settings = state.settings.data;

    return {
        address: settings.proxy_address,
        username: settings.proxy_username,
        password: settings.proxy_password,
        trust: settings.proxy_trust
    };
};

const mapDispatchToProps = (dispatch) => ({

    onUpdateAddress: (e) => {
        dispatch(updateSetting("proxy_address", e.value));
    },

    onUpdateUsername: (e) => {
        dispatch(updateSetting("proxy_username", e.value));
    },

    onUpdatePassword: (e) => {
        dispatch(updateSetting("proxy_password", e.value));
    },

    onUpdateTrust: (value) => {
        dispatch(updateSetting("proxy_trust", value));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ProxyOptions);
