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
import { Panel, ButtonToolbar } from "react-bootstrap";
import { Icon } from "../../components/Base/Icon";
import CUDA from "./CUDA";

const Welcome  = () => (
    <div className="container">
        <Panel>
            <p>Viral infection diagnostics using next-generation sequencing</p>

            <ButtonToolbar>
                <a className="btn btn-default" href="http://www.virtool.ca/" target="_blank">
                    <Icon name="vtlogo" /> Website
                </a>
                <a className="btn btn-default" href="https://github.com/virtool/virtool" target="_blank">
                    <Icon name="github" /> Github
                </a>
                <a className="btn btn-default" href="/doc/index.html?v=2" target="_blank">
                    <Icon name="book" /> Documentation
                </a>
            </ButtonToolbar>
        </Panel>

        <CUDA />
    </div>
);

export default Welcome;
