/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Limits
 */

import React from "react";
import { Panel } from "react-bootstrap";
import { InputSave } from "virtool/js/components/Base";

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
const Limits = (props) => (
    <Panel>
        <InputSave
            label="CPU Limit"
            type="number"
            onSave={(event) => props.set("proc", event.value)}
            initialValue={props.settings.proc}
        />
        <InputSave
            label="Memory Limit (GB)"
            type="number"
            onSave={(event) => props.set("mem", event.value)}
            initialValue={props.settings.mem}
        />
    </Panel>
);

Limits.propTypes = {
    set: React.PropTypes.func,
    settings: React.PropTypes.object
};

export default Limits;
