import React from "react";
import styled from "styled-components";
import { InputError, SaveButton, DialogBody, DialogFooter } from "../../base";

const NameAbbreviation = styled(DialogBody)`
    display: grid;
    grid-template-columns: 9fr 4fr;
    grid-gap: 13px;
`;

const OTUForm = props => (
    <form onSubmit={props.handleSubmit}>
        <NameAbbreviation>
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
        </NameAbbreviation>
        <DialogFooter>
            <SaveButton pullRight />
        </DialogFooter>
    </form>
);

export default OTUForm;
