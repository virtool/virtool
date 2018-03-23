import React from "react";
import { toNumber } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSetting } from "../../actions";
import { Checkbox, Icon, InputError } from "../../../base";

const HTTPCheckboxLabel = () => (
    <span>
        Enable <a rel="noopener noreferrer" href="https://docs.virtool.ca/web-api.html" target="_blank">API</a>
    </span>
);

const HTTPFooter = () => (
    <small className="text-warning">
        <Icon name="warning" /> Changes to these settings will only take effect when the server is reloaded.
    </small>
);

const HTTPOptions = (props) => (
    <Row>
        <Col xs={12}>
            <h5><strong>HTTP Server</strong></h5>
        </Col>
        <Col xs={12} md={6} mdPush={6}>
            <Panel>
                <Panel.Body>
                    Change the address and port the the web server listens on.
                </Panel.Body>
                <Panel.Footer>
                    <HTTPFooter />
                </Panel.Footer>
            </Panel>
        </Col>
        <Col xs={12} md={6} mdPull={6}>
            <Panel>
                <Panel.Body>
                    <InputError
                        label="Host"
                        autoComplete={false}
                        onSave={props.onUpdateHost}
                        initialValue={props.host}
                        noMargin
                        withButton
                    />
                    <InputError
                        label="Port"
                        type="number"
                        autoComplete={false}
                        onSave={props.onUpdatePort}
                        initialValue={props.port}
                        noMargin
                        withButton
                    />
                    <Checkbox
                        label={<HTTPCheckboxLabel />}
                        checked={props.enableApi}
                        onClick={() => props.onUpdateAPI(!props.enableApi)}
                    />
                </Panel.Body>
            </Panel>
        </Col>
    </Row>
);

const mapStateToProps = (state) => ({
    host: state.settings.data.server_host,
    port: state.settings.data.server_port,
    enableApi: state.settings.data.enable_api
});

const mapDispatchToProps = (dispatch) => ({

    onUpdateHost: (e) => {
        dispatch(updateSetting("server_host", e.value));
    },

    onUpdatePort: (e) => {
        dispatch(updateSetting("server_port", toNumber(e.value)));
    },

    onUpdateAPI: (value) => {
        dispatch(updateSetting("enable_api", value));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(HTTPOptions);
