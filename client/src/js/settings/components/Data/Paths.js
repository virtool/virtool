/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PathsOptions
 */

import React from "react";
import { Panel } from "react-bootstrap";
import { InputSave } from "virtool/js/components/Base";

/**
 * A set of InputSave components for updating data and watch path settings.
 */
const PathsOptions = (props) => (
    <Panel>
        <InputSave
            label="Virtool Data"
            name="watch_path"
            onSave={(event) => props.set("data_path", event.value)}
            initialValue={props.settings.data_path}
        />
        <InputSave
            label="Watch Folder"
            name="watch_path"
            onSave={(event) => props.set("watch_path", event.value)}
            initialValue={props.settings.watch_path}
        />
    </Panel>
);

PathsOptions.propTypes = {
    set: React.PropTypes.func,
    settings: React.PropTypes.object
};

export default PathsOptions;
