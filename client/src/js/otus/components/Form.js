import React from "react";
import styled from "styled-components";
import { ModalBody, ModalFooter, Input, InputError, InputGroup, InputLabel, SaveButton } from "../../base";

const OTUFormBody = styled(ModalBody)`
    display: grid;
    grid-template-columns: 9fr 4fr;
    grid-column-gap: ${props => props.gap.column};
`;

export const OTUForm = ({ abbreviation, name, error, onChange, onSubmit }) => (
    <form onSubmit={onSubmit}>
        <OTUFormBody>
            <InputGroup>
                <InputLabel>Name</InputLabel>
                <Input error={error} name="name" value={name} onChange={onChange} />
                <InputError>{error}</InputError>
            </InputGroup>

            <InputGroup>
                <InputLabel>Abbreviation</InputLabel>
                <Input name="abbreviation" value={abbreviation} onChange={onChange} />
            </InputGroup>
        </OTUFormBody>
        <ModalFooter>
            <SaveButton />
        </ModalFooter>
    </form>
);
