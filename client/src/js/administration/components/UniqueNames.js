import React from "react";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";
import { updateSetting } from "../actions";
import { Checkbox, Button } from "../../base/index";
import AdministrationSection from "./Section";

const UniqueNames = ({ enabled, onToggle }) => {
    const description = `Enable this feature to ensure that every created sample has a unique name. If a user
    attempts to assign an existing name to a new sample an error will be displayed.`;

    const content = (
        <Panel.Body>
            <Button
                onClick={() => {
                    onToggle(!enabled);
                }}
                block
            >
                <Checkbox checked={enabled} /> Enable
            </Button>
        </Panel.Body>
    );

    return <AdministrationSection title="Unique Sample Names" description={description} content={content} />;
};

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
