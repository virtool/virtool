import React from "react";
import PropTypes from "prop-types";
import { Input, InputContainer, InputError, InputGroup, InputLabel } from "../../base";
import { getTargetChange } from "../../utils/utils";
import { Accession } from "./Accession";
import SequenceField from "./Field";

export const SequenceForm = ({ accession, definition, errors, host, sequence, onChange }) => {
    const handleAutofill = ({ accession, definition, host, sequence }) =>
        onChange({
            accession,
            definition,
            host,
            sequence
        });

    const handleChange = e => {
        const { name, value } = getTargetChange(e.target);
        onChange({ [name]: value });
    };

    return (
        <React.Fragment>
            <Accession
                accession={accession}
                error={errors.accession}
                onAutofill={handleAutofill}
                onChange={handleChange}
            />

            <InputGroup>
                <InputLabel>Host</InputLabel>
                <Input name="host" value={host} onChange={handleChange} />
            </InputGroup>

            <InputGroup>
                <InputLabel>Definition</InputLabel>
                <InputContainer>
                    <Input name="definition" value={definition} onChange={handleChange} />
                    <InputError>{errors.definition}</InputError>
                </InputContainer>
            </InputGroup>

            <SequenceField name="sequence" sequence={sequence} onChange={handleChange} error={errors.sequence} />
        </React.Fragment>
    );
};

SequenceForm.propTypes = {
    accession: PropTypes.string.isRequired,
    definition: PropTypes.string.isRequired,
    errors: PropTypes.object.isRequired,
    host: PropTypes.string.isRequired,
    sequence: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};
