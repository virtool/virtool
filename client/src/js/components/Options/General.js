/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports GeneralOptions
 */

import React from "react";
import { Row, Col, Panel } from "react-bootstrap";

import SettingsProvider from "./SettingsProvider";
import SourceTypes from "./General/SourceTypes";
import InternalControl from "./General/InternalControl";
import UniqueNames from "./General/UniqueNames";
import SamplePermissions from "./General/SamplePermissions";

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
const GeneralOptionsInner = (props) => (
    <div>
        <SourceTypes {...props} />

        <InternalControl
            {...props}
        />

        <Row>
            <Col md={12}>
                <h5><strong>Unique Sample Names</strong></h5>
            </Col>
            <Col md={6}>
                <UniqueNames {...props} />
            </Col>
            <Col md={6}>
                <Panel>
                    Enable this feature to ensure that every created sample has a unique name. If a user
                    attempts to assign an existing name to a new sample an error will be displayed.
                </Panel>
            </Col>
        </Row>
        <Row>
            <Col md={12}>
                <h5><strong>Default Sample Permissions</strong></h5>
            </Col>
            <Col md={6}>
                <SamplePermissions {...props} />
            </Col>
            <Col md={6}>
                <Panel>
                    Set the method used to assign groups to new samples and the default rights.
                </Panel>
            </Col>
        </Row>
    </div>
);

GeneralOptionsInner.propsTypes = {
    set: React.PropTypes.func,
    settings: React.PropTypes.object
};

const GeneralOptions = () => (
    <SettingsProvider>
        <GeneralOptionsInner />
    </SettingsProvider>
);

export default GeneralOptions;
