import React from "react";
import { toNumber } from "lodash-es";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";
import AdministrationSection from "../Section";
import { updateSetting } from "../../actions";
import { Checkbox, Icon, InputError } from "../../../base";

export const HTTPCheckboxLabel = () => (
    <span>
        Enable{" "}
        <a rel="noopener noreferrer" href="https://www.virtool.ca/docs/api/" target="_blank">
            API
        </a>
    </span>
);

export const HTTPFooter = () => (
    <small className="text-warning">
        <Icon name="exclamation-triangle" /> Changes to these settings will only take effect when the server is
        reloaded.
    </small>
);

export const HTTPOptions = props => {
    const content = (
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
    );

    return (
        <AdministrationSection
            title="HTTP Server"
            description="Change the address and port the the web server listens on."
            footerComponent={<HTTPFooter />}
            content={content}
        />
    );
};

const mapStateToProps = state => ({
    host: state.settings.data.server_host,
    port: state.settings.data.server_port,
    enableApi: state.settings.data.enable_api
});

const mapDispatchToProps = dispatch => ({
    onUpdateHost: e => {
        dispatch(updateSetting("server_host", e.value));
    },

    onUpdatePort: e => {
        dispatch(updateSetting("server_port", toNumber(e.value)));
    },

    onUpdateAPI: value => {
        dispatch(updateSetting("enable_api", value));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(HTTPOptions);
