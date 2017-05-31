/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ServerOptions
 */

import React from "react";
import { Row, Col, Panel } from "react-bootstrap";

import HTTP from "./Server/HTTP";
import Security from "./Server/Security";
import Lifecycle from "./Server/Lifecycle";
import SettingsProvider from "./SettingsProvider";

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
const ServerOptionsInner = (props) => (
    <div>
        <HTTP {...props} />
        <Security {...props} />

        <Row>
            <Col md={12}>
                <h5><strong>Lifecycle Controls</strong></h5>
            </Col>
            <Col md={6}>
                <Lifecycle {...props} />
            </Col>
            <Col md={6}>
                <Panel>
                    Reload the server settings and clear connections or shutdown the server completely.
                </Panel>
            </Col>
        </Row>
    </div>
);

ServerOptionsInner.propTypes = {
    set: React.PropTypes.func,
    settings: React.PropTypes.object
};

const ServerOptions = () => (
    <SettingsProvider>
        <ServerOptionsInner/>
    </SettingsProvider>
);

export default ServerOptions;
