/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UpdateOptions
 */

import React from "react";
import { Panel } from "react-bootstrap";
import SettingsProvider from "./SettingsProvider";

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
const UpdateOptionsInner = (props) => (
    <div>
        <h5><strong>Software Update</strong></h5>
        <Panel>
            Current version is {props.settings.server_version}
        </Panel>
    </div>
);

UpdateOptionsInner.propTypes = {
    set: React.PropTypes.func,
    settings: React.PropTypes.object
};

const UpdateOptions = () => (
    <SettingsProvider>
        <UpdateOptionsInner/>
    </SettingsProvider>
);

export default UpdateOptions;
