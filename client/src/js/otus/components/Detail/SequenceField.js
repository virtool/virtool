import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Badge, InputContainer, InputError, InputGroup, InputLabel, TextArea } from "../../../base";

export const SequenceFieldTextArea = styled(TextArea)`
    font-family: "Roboto Mono", monospace;
`;

const SequenceField = ({ sequence = "", readOnly = false, onChange, error }) => (
    <InputGroup>
        <InputLabel>
            Sequence <Badge>{sequence.length}</Badge>
        </InputLabel>
        <InputContainer>
            <SequenceFieldTextArea name="sequence" value={sequence} onChange={onChange} readOnly={readOnly} />
            <InputError>{error}</InputError>
        </InputContainer>
    </InputGroup>
);

SequenceField.propTypes = {
    readOnly: PropTypes.bool,
    error: PropTypes.string,
    sequence: PropTypes.string,
    onChange: PropTypes.func
};

export default SequenceField;
