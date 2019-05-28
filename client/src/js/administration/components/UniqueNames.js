import React from "react";
import { connect } from "react-redux";
import { updateSetting } from "../actions";
import { SettingsCheckbox } from "./SettingsCheckbox";

const UniqueNames = ({ enabled, onToggle }) => (
    <SettingsCheckbox enabled={enabled} onToggle={onToggle}>
        <strong>Unique Sample Names</strong>
        <small>
            Enable this feature to ensure that every created sample has a unique name. If a user attempts to assign an
            existing name to a new sample an error will be displayed.
        </small>
    </SettingsCheckbox>
);

const mapStateToProps = state => ({
    enabled: state.settings.data.sample_unique_names
});

const mapDispatchToProps = dispatch => ({
    onToggle: value => {
        dispatch(updateSetting("sample_unique_names", value));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(UniqueNames);
