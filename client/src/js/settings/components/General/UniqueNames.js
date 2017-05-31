/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UniqueNames
 */

import React from "react";
import { Panel } from "react-bootstrap";
import { Checkbox, Button } from "virtool/js/components/Base";

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
const UniqueNames = (props) => {

    const enabled = props.settings.sample_unique_names;

    return (
        <Panel>
            <Button onClick={() => props.set("sample_unique_names", !enabled)} block>
                <Checkbox checked={enabled} /> Enable
            </Button>
        </Panel>
    );
};

UniqueNames.propTypes = {
    set: React.PropTypes.func,
    settings: React.PropTypes.object
};

export default UniqueNames;
