import React from "react";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";
import { updateSetting } from "../actions";
import { Icon, InputError } from "../../base";
import AdministrationSection from "./Section";

export const WarningFooter = () => (
    <small className="text-danger">
        <Icon name="exclamation-triangle" /> Changing these settings can make Virtool non-functional
    </small>
);

export const DataOptions = ({ db_name, db_host, db_port, data_path, watch_path, onSave }) => {
    const contentDatabase = (
        <Panel.Body>
            <InputError
                label="Database Name"
                onSave={e => onSave("db_name", e.value)}
                initialValue={db_name}
                noMargin
                withButton
            />
            <InputError
                label="MongoDB Host"
                onSave={e => onSave("db_host", e.value)}
                initialValue={db_host}
                noMargin
                withButton
            />
            <InputError
                label="MongoDB Port"
                type="number"
                onSave={e => onSave("db_port", Number(e.value))}
                initialValue={db_port}
                noMargin
                withButton
            />
        </Panel.Body>
    );

    const contentPaths = (
        <Panel.Body>
            <InputError
                label="Virtool Data"
                onSave={e => onSave("data_path", e.value)}
                initialValue={data_path}
                noMargin
                withButton
            />
            <InputError
                label="Watch Folder"
                onSave={e => onSave("watch_path", e.value)}
                initialValue={watch_path}
                noMargin
                withButton
            />
        </Panel.Body>
    );

    return (
        <div className="settings-container">
            <AdministrationSection
                title="Database"
                description="Change the parameters for connecting to MongoDB"
                footerComponent={<WarningFooter />}
                content={contentDatabase}
            />
            <AdministrationSection
                title="Paths"
                description="Set the paths where Virtool looks for its data files and for FASTQ files to import."
                footerComponent={<WarningFooter />}
                content={contentPaths}
            />
        </div>
    );
};

const mapStateToProps = state => ({
    ...state.settings.data
});

const mapDispatchToProps = dispatch => ({
    onSave: (key, value) => {
        dispatch(updateSetting(key, value));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(DataOptions);
