/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports DataOptions
 */

import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSettings } from "../actions";
import { Icon, InputSave } from "virtool/js/components/Base";

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
const DataOptions = (props) => {

    const warningFooter = (
        <small className="text-danger">
            <Icon name="warning" /> Changing these settings can make Virtool non-functional
        </small>
    );

    return (
        <div>
            <Row>
                <Col md={12}>
                    <h5><strong>Database</strong></h5>
                </Col>
                <Col xs={12} md={6}>
                    <Panel footer={warningFooter}>
                        Change the parameters for connecting to MongoDB.
                    </Panel>
                </Col>
                <Col xs={12} md={6}>
                    <Panel>
                        <InputSave
                            label="Database Name"
                            onSave={(e) => props.onSave("db_name", e.value)}
                            initialValue={props.dbName}
                        />
                        <InputSave
                            label="MongoDB Host"
                            onSave={(e) => props.onSave("db_host", e.value)}
                            initialValue={props.dbHost}
                        />
                        <InputSave
                            label="MongoDB Port"
                            type="number"
                            onSave={(e) => props.onSave("db_port", Number(e.value))}
                            initialValue={props.dbPort}
                        />
                    </Panel>
                </Col>
            </Row>
            <Row>
                <Col xs={12}>
                    <h5><strong>Paths</strong></h5>
                </Col>
                <Col xs={12} md={6} mdPush={6}>
                    <Panel footer={warningFooter}>
                        Set the paths where Virtool looks for its data files and for FASTQ files to import.
                    </Panel>
                </Col>
                <Col xs={12} md={6} mdPull={6}>
                    <Panel>
                        <InputSave
                            label="Virtool Data"
                            onSave={(e) => props.onSave("watch_path", e.value)}
                            initialValue={props.dataPath}
                        />
                        <InputSave
                            label="Watch Folder"
                            onSave={(e) => props.onSave("watch_path", e.value)}
                            initialValue={props.watchPath}
                        />
                    </Panel>
                </Col>
            </Row>
        </div>
    )
};

const mapStateToProps = (state) => {

    const settings = state.settings.data;

    return {
        dataPath: settings.data_path,
        watchPath: settings.watch_path,
        dbName: settings.db_name,
        dbHost: settings.db_host,
        dbPort: settings.db_port
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onSave: (key, value) => {
            let update = {};
            update[key] = value;
            dispatch(updateSettings(update));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(DataOptions);

export default Container;
