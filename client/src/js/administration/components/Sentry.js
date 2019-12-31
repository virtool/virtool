import React from "react";
import { connect } from "react-redux";
import { updateSetting } from "../actions";
import { SettingsCheckbox } from "./SettingsCheckbox";

export const SentryOptions = ({ enabled, onToggle }) => (
    <SettingsCheckbox enabled={enabled} onToggle={onToggle}>
        <h2>Sentry</h2>
        <small>
            Enable or disable Sentry error reporting. Error reporting allows the developers to prevent future errors.
        </small>
    </SettingsCheckbox>
);

export const mapStateToProps = state => ({
    enabled: state.settings.data.enable_sentry
});

export const mapDispatchToProps = dispatch => ({
    onToggle: value => {
        dispatch(updateSetting("enable_sentry", value));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SentryOptions);
