import React from "react";
import { Input, InputError, InputGroup, InputLabel, TextArea } from "../../base";

export const ReferenceForm = ({ description, organism, mode, name, errorName, onChange }) => {
    let organismComponent;

    if (mode === "empty") {
        organismComponent = (
            <InputGroup>
                <InputLabel>Organism</InputLabel>
                <Input name="organism" value={organism} onChange={onChange} />
            </InputGroup>
        );
    }

    return (
        <React.Fragment>
            <InputGroup>
                <InputLabel>Name</InputLabel>
                <Input name="name" error={errorName} value={name} onChange={onChange} />
                <InputError>{errorName}</InputError>
            </InputGroup>

            {organismComponent}

            <InputGroup>
                <InputLabel>Description</InputLabel>
                <TextArea name="description" value={description} onChange={onChange} />
            </InputGroup>
        </React.Fragment>
    );
};
