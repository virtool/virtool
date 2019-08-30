import React from "react";
import { connect } from "react-redux";
import { updateSetting } from "../actions";
import { SettingsCheckbox } from "./SettingsCheckbox";

export const UniqueNames = ({ enabled, onToggle }) => (
    <SettingsCheckbox enabled={enabled} onToggle={onToggle}>
        <h2>Unique Sample Names</h2>
        <small>
            Enable this feature to ensure that every created sample has a unique name. If a user attempts to assign an
            existing name to a new sample an error will be displayed.
        </small>
    </SettingsCheckbox>
);

export const mapStateToProps = state => ({
    enabled: state.settings.data.sample_unique_names
});

export const mapDispatchToProps = dispatch => ({
    onToggle: value => {
        dispatch(updateSetting("sample_unique_names", value));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(UniqueNames);
