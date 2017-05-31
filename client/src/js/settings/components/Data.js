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
import { Row, Col, Panel } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";

import SettingsProvider from "./SettingsProvider";
import DatabaseOptions from "./Data/Database";
import PathsOptions from "./Data/Paths";

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
const DataOptionsInner = (props) => {

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
                <Col md={6}>
                    <DatabaseOptions {...props} />
                </Col>
                <Col md={6}>
                    <Panel footer={warningFooter}>
                        Change the parameters for connecting to MongoDB.
                    </Panel>
                </Col>
            </Row>
            <Row>
                <Col md={12}>
                    <h5><strong>Paths</strong></h5>
                </Col>
                <Col md={6}>
                    <PathsOptions {...props} />
                </Col>
                <Col md={6}>
                    <Panel footer={warningFooter}>
                        Set the paths where Virtool looks for its data files and for FASTQ files to import.
                    </Panel>
                </Col>
            </Row>
        </div>
    )
};

DataOptionsInner.propsTypes = {
    set: React.PropTypes.func,
    settings: React.PropTypes.object
};

const DataOptions = () => (
    <SettingsProvider>
        <DataOptionsInner />
    </SettingsProvider>
);

export default DataOptions;
