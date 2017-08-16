/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Security
 */

import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSettings } from "../../actions";
import { Icon, Flex, FlexItem, InputSave, Checkbox } from "virtool/js/components/Base";

const SSLFooter = () => (
    <small className="text-warning">
        <Icon name="warning" /> Changes to these settings will only take effect when the server is reloaded.
    </small>
);

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
const SSLOptions = (props) => (
    <div>
        <Row>
            <Col sm={12} md={6}>
                <Flex alignItems="center" style={{marginBottom: "10px"}}>
                    <FlexItem grow={1}>
                        <strong>SSL</strong>
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
        <Row>
            <Col sm={12} md={6} mdPush={6}>
                <Panel footer={<SSLFooter />}>
                    Configure the server to use SSL.
                </Panel>
            </Col>
            <Col sm={12} md={6} mdPull={6}>
                <Panel>
                    <InputSave
                        label="Certificate Path"
                        onSave={event => props.onChangeCertPath(event.value)}
                        initialValue={props.certPath}
                        disabled={!props.enabled}
                    />
                    <InputSave
                        label="Key Path"
                        onSave={event => props.onChangeKeyPath(event.value)}
                        initialValue={props.keyPath}
                        disabled={!props.enabled}
                    />
                </Panel>
            </Col>
        </Row>
    </div>
);

SSLOptions.propTypes = {
    enabled: React.PropTypes.bool,
    certPath: React.PropTypes.string,
    keyPath: React.PropTypes.string,
    onToggle: React.PropTypes.func,
    onChangeCertPath: React.PropTypes.func,
    onChangeKeyPath: React.PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        enabled: state.settings.data.use_ssl,
        certPath: state.settings.data.cert_path,
        keyPath: state.settings.data.key_path
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onToggle: (enabled) => {
            dispatch(updateSettings({use_ssl: enabled}));
        },

        onChangeCertPath: (path) => {
            dispatch(updateSettings({cert_path: path}));
        },

        onChangeKeyPath: (path) => {
            dispatch(updateSettings({key_path: path}));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SSLOptions);

export default Container;
