import React from "react";
import styled from "styled-components";
import { DialogBody, DialogFooter, Input, InputError, InputGroup, InputLabel, SaveButton } from "../../base";

const OTUFormFields = styled(DialogBody)`
    display: grid;
    grid-template-columns: 9fr 4fr;
    grid-column-gap: 15px;
`;

const OTUForm = ({ abbreviation, name, error, onChange, onSubmit }) => (
    <form onSubmit={onSubmit}>
        <OTUFormFields>
            <InputGroup>
                <InputLabel>Name</InputLabel>
                <Input error={error} name="name" value={name} onChange={onChange} />
                <InputError>{error}</InputError>
            </InputGroup>

            <InputGroup>
                <InputLabel>Abbreviation</InputLabel>
                <Input name="abbreviation" value={abbreviation} onChange={onChange} />
            </InputGroup>
        </OTUFormFields>
        <DialogFooter>
            <SaveButton pullRight />
        </DialogFooter>
    </form>
);

export default OTUForm;
