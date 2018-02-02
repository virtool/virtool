import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSetting } from "../../actions";
import { Checkbox, Flex, FlexItem, Icon, InputSave } from "../../../base";

const ProxyFooter = () => (
    <small className="text-danger">
        <Icon name="warning" /> Proxy authentication is stored in plain text in the settings file.
    </small>
);

const ProxyOptions = (props) => (
    <Row>
        <Col xs={12}>
            <Row>
                <Col xs={12} md={6}>
                    <Flex alignItems="center" style={{marginBottom: "10px"}}>
                        <FlexItem grow={1}>
                            <strong>Proxy</strong>
                        </FlexItem>
                        <FlexItem>
                            <Checkbox
                                label="Enable"
                                checked={props.enabled}
                                onClick={() => {props.onToggle(!props.enabled)}}
                            />
                        </FlexItem>
                    </Flex>
                </Col>
                <Col smHidden md={6} />
            </Row>
        </Col>
        <Col xs={12} md={6} mdPush={6}>
            <Panel footer={<ProxyFooter />}>
                Configure the server to use a proxy for outgoing requests.
            </Panel>
        </Col>
        <Col xs={12} md={6} mdPull={6}>
            <Panel>
                <InputSave
                    label="Address"
                    autoComplete={false}
                    onSave={props.onUpdateAddress}
                    initialValue={props.host}
                    disabled={!props.enabled}
                />
                <InputSave
                    label="Username"
                    autoComplete={false}
                    onSave={props.onUpdateUsername}
                    initialValue={props.username}
                    disabled={!props.enabled}
                />
                <InputSave
                    label="Password"
                    type="password"
                    autoComplete={false}
                    onSave={props.onUpdatePassword}
                    initialValue={props.password}
                    disabled={!props.enabled}
                />
                <Checkbox
                    label="Trust Environmental Variables"
                    checked={props.trust}
                    onClick={() => props.onUpdateTrust(!props.trust)}
                    disabled={!props.enabled}
                />
            </Panel>
        </Col>
    </Row>
);

const mapStateToProps = (state) => {
    const settings = state.settings.data;

    return {
        address: settings.proxy_address,
        enabled: settings.proxy_enable,
        username: settings.proxy_username,
        password: settings.proxy_password,
        trust: settings.proxy_trust
    };
};

const mapDispatchToProps = (dispatch) => ({

    onToggle: (value) => {
        dispatch(updateSetting("proxy_enable", value));
    },

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
