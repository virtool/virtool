import React from "react";
import { Checkbox, Input, InputError, InputGroup, InputLabel, TextArea } from "../../../../base";

export const TargetForm = ({ description, errorName, length, name, required, onChange, onClick }) => {
    return (
        <React.Fragment>
            <InputGroup>
                <InputLabel>Name</InputLabel>
                <Input error={errorName} name="name" value={name} onChange={onChange} />
                <InputError>{errorName}</InputError>
            </InputGroup>

            <InputGroup>
                <InputLabel>Description</InputLabel>
                <TextArea name="description" value={description} onChange={onChange} />
            </InputGroup>

            <InputGroup>
                <InputLabel>Length</InputLabel>
                <Input type="number" name="length" value={length} onChange={onChange} />
            </InputGroup>

            <Checkbox label="Required" checked={required} onClick={onClick} />
        </React.Fragment>
    );
};
