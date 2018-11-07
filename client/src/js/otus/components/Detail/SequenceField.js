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
import { Badge } from "react-bootstrap";
import { InputError } from "../../../base";

/**
 * A component that wraps a textarea input element. Used for displaying and editing genetic sequences.
 *
 * @class
 */
const SequenceField = ({ sequence, readOnly, onChange, error }) => (
    <InputError
        label={
            <div>
                {" "}
                Sequence <Badge>{sequence.length}</Badge>
            </div>
        }
        name="sequence"
        className="sequence"
        type="textarea"
        value={sequence}
        onChange={onChange}
        readOnly={readOnly}
        rows={5}
        error={error}
    />
);

SequenceField.defaultProps = {
    sequence: "",
    readOnly: false
};

export default SequenceField;
