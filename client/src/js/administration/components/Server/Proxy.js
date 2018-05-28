import React from "react";
import { ClipLoader } from "halogenium";
import { connect } from "react-redux";
import { Col, Panel, Row } from "react-bootstrap";

import { testProxy, updateSetting } from "../../actions";
import { Button, Checkbox, Flex, FlexItem, Icon, InputError } from "../../../base";

const ProxyFooter = () => (
    <small className="text-danger">
        <Icon name="warning" /> Proxy authentication is stored in plain text in the settings file.
    </small>
);

const ProxyTestIcon = ({ proxyTestPending, proxyTestSucceeded, proxyTestFailed }) => {

    if (proxyTestPending) {
        return (
            <div style={{padding: "0 1px"}}>
                <ClipLoader size="12px" color="#333" />
            </div>
        );
    }

    let iconName = "cloud";
    let iconStyle;

    if (proxyTestSucceeded) {
        iconName = "checkmark";
        iconStyle = "success";
    }

    if (proxyTestFailed) {
        iconName = "blocked";
        iconStyle = "danger";
    }

    return <Icon name={iconName} bsStyle={iconStyle} />;

};

const ProxyOptions = (props) => {

    const disableInputs = !props.enabled || props.trust;

    const errorProxyAddress = props.proxyTestFailed || null;

    return (
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
                                    onClick={() => props.onToggle(!props.enabled)}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col smHidden md={8} />
                </Row>
            </Col>

            <Col xs={12} md={6} mdPush={6}>
                <Panel>
                    <Panel.Body>
                        Configure the server to use a proxy for outgoing requests.
                    </Panel.Body>
                    <Panel.Footer>
                        <ProxyFooter />
                    </Panel.Footer>
                </Panel>
            </Col>
            <Col xs={12} md={6} mdPull={6}>
                <Panel>
                    <Panel.Body>
                        <InputError
                            label="Address"
                            autoComplete={false}
                            onSave={props.onUpdateAddress}
                            initialValue={props.address}
                            disabled={disableInputs}
                            error={errorProxyAddress}
                            noMargin
                            withButton
                        />
                        <InputError
                            label="Username"
                            autoComplete={false}
                            onSave={props.onUpdateUsername}
                            initialValue={props.username}
                            disabled={disableInputs}
                            noMargin
                            withButton
                        />
                        <InputError
                            label="Password"
                            type="password"
                            autoComplete={false}
                            onSave={props.onUpdatePassword}
                            initialValue={props.password}
                            disabled={disableInputs}
                            noMargin
                            withButton
                        />
                        <Flex alignItems="center">
                            <FlexItem grow={1} shrink={0}>
                                <Checkbox
                                    label="Trust Environmental Variables"
                                    checked={props.trust}
                                    onClick={() => props.onUpdateTrust(!props.trust)}
                                    disabled={!props.enabled}
                                />
                            </FlexItem>
                            <FlexItem grow={0} shrink={0}>
                                <Button onClick={props.onTest} disabled={!props.enabled} pullRight>
                                    <Flex>
                                        <FlexItem>
                                            <ProxyTestIcon {...props} />
                                        </FlexItem>
                                        <FlexItem pad>
                                            Test
                                        </FlexItem>
                                    </Flex>
                                </Button>
                            </FlexItem>
                        </Flex>
                    </Panel.Body>
                </Panel>
            </Col>
        </Row>
    );
};

const mapStateToProps = (state) => {

    const { data, proxyTestPending, proxyTestSucceeded, proxyTestFailed } = state.settings;

    return {
        address: data.proxy_address,
        enabled: data.proxy_enable,
        username: data.proxy_username,
        password: data.proxy_password,
        trust: data.proxy_trust,

        proxyTestPending,
        proxyTestSucceeded,
        proxyTestFailed
    };
};

const mapDispatchToProps = (dispatch) => ({

    onTest: () => {
        dispatch(testProxy());
    },

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
