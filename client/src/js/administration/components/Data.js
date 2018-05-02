import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";

import { updateSetting } from "../actions";
import { Icon, InputError } from "../../base";

const WarningFooter = () => (
    <small className="text-danger">
        <Icon name="warning" /> Changing these settings can make Virtool non-functional
    </small>
);

const DataOptions = ({ db_name, db_host, db_port, data_path, watch_path, onSave }) => (
    <div>
        <Row>
            <Col md={12}>
                <h5><strong>Database</strong></h5>
            </Col>
            <Col xs={12} md={6} mdPush={6}>
                <Panel>
                    <Panel.Body>
                        Change the parameters for connecting to MongoDB.
                    </Panel.Body>
                    <Panel.Footer>
                        <WarningFooter />
                    </Panel.Footer>
                </Panel>
            </Col>
            <Col xs={12} md={6} mdPull={6}>
                <Panel>
                    <Panel.Body>
                        <InputError
                            label="Database Name"
                            onSave={(e) => onSave("db_name", e.value)}
                            initialValue={db_name}
                            noMargin
                            withButton
                        />
                        <InputError
                            label="MongoDB Host"
                            onSave={(e) => onSave("db_host", e.value)}
                            initialValue={db_host}
                            noMargin
                            withButton
                        />
                        <InputError
                            label="MongoDB Port"
                            type="number"
                            onSave={(e) => onSave("db_port", Number(e.value))}
                            initialValue={db_port}
                            noMargin
                            withButton
                        />
                    </Panel.Body>
                </Panel>
            </Col>
        </Row>
        <Row>
            <Col xs={12}>
                <h5><strong>Paths</strong></h5>
            </Col>
            <Col xs={12} md={6} mdPush={6}>
                <Panel>
                    <Panel.Body>
                        Set the paths where Virtool looks for its data files and for FASTQ files to import.
                    </Panel.Body>
                    <Panel.Footer>
                        <WarningFooter />
                    </Panel.Footer>
                </Panel>
            </Col>
            <Col xs={12} md={6} mdPull={6}>
                <Panel>
                    <Panel.Body>
                        <InputError
                            label="Virtool Data"
                            onSave={(e) => onSave("watch_path", e.value)}
                            initialValue={data_path}
                            noMargin
                            withButton
                        />
                        <InputError
                            label="Watch Folder"
                            onSave={(e) => onSave("watch_path", e.value)}
                            initialValue={watch_path}
                            noMargin
                            withButton
                        />
                    </Panel.Body>
                </Panel>
            </Col>
        </Row>
    </div>
);

const mapStateToProps = (state) => ({
    ...state.settings.data
});

const mapDispatchToProps = (dispatch) => ({

    onSave: (key, value) => {
        dispatch(updateSetting(key, value));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(DataOptions);
