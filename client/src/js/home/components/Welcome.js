/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Welcome
 */

import React from "react";
import { Panel } from "react-bootstrap";
import { Icon } from "../../base";

const Welcome  = () => (
    <div className="container">
        <Panel>
            <p>Viral infection diagnostics using next-generation sequencing</p>

            <a className="btn btn-default" href="http://www.virtool.ca/" target="_blank" rel="noopener noreferrer">
                <Icon name="vtlogo" /> Website
            </a>
        </Panel>
    </div>
);

export default Welcome;
