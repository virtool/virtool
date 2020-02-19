import React from "react";
import styled from "styled-components";
import { InputError, SaveButton, DialogBody, DialogFooter } from "../../base";

const OTUFormFields = styled(DialogBody)`
    display: grid;
    grid-template-columns: 9fr 4fr;
    grid-gap: 13px;
`;

const OTUForm = props => (
    <form onSubmit={props.handleSubmit}>
        <OTUFormFields>
            <InputError
                label="Name"
                name="name"
                value={props.name}
                onChange={props.handleChange}
                error={props.errorName}
            />
            <InputError
                label="Abbreviation"
                name="abbreviation"
                value={props.abbreviation}
                onChange={props.handleChange}
                error={props.errorAbbreviation}
            />
        </OTUFormFields>
        <DialogFooter>
            <SaveButton pullRight />
        </DialogFooter>
    </form>
);

export default OTUForm;
