/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SequenceField
 */


import React from "react";
import { Badge, FormGroup, FormControl, ControlLabel } from "react-bootstrap";

/**
 * A component that wraps a textarea input element. Used for displaying and editing genetic sequences.
 *
 * @class
 */
const SequenceField = ({ sequence, readOnly, onChange }) => (
    <FormGroup>
        <ControlLabel>
            Sequence <Badge>{sequence.length}</Badge>
        </ControlLabel>
        <FormControl
            name="sequence"
            className="sequence"
            componentClass="textarea"
            value={sequence}
            onChange={onChange}
            readOnly={readOnly}
            rows={5}
        />
    </FormGroup>
);

SequenceField.defaultProps = {
    sequence: "",
    readOnly: false
};

export default SequenceField;
