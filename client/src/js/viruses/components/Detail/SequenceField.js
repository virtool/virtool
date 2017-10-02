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
import PropTypes from "prop-types";
import { Badge, FormGroup, FormControl, ControlLabel } from "react-bootstrap";

/**
 * A component that wraps a textarea input element. Used for displaying and editing genetic sequences.
 *
 * @class
 */
const SequenceField = (props) => {
    return (
        <FormGroup>
            <ControlLabel>
                Sequence <Badge>{props.sequence.length}</Badge>
            </ControlLabel>
            <FormControl
                name="sequence"
                className="sequence"
                componentClass="textarea"
                value={props.sequence}
                onChange={props.onChange}
                readOnly={props.readOnly}
                rows={5}
            />
        </FormGroup>
    );
};

SequenceField.propTypes = {
    sequence: PropTypes.string,
    readOnly: PropTypes.bool,
    onChange: PropTypes.func
};

SequenceField.defaultProps = {
    sequence: "",
    readOnly: false
};

export default SequenceField;
