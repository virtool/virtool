import React from "react";
import styled from "styled-components";
import { Box, Button, Color, Input, InputError, InputGroup, InputLabel, ModalBody, ModalFooter } from "../../base";
import { SampleLabel } from "../../samples/components/Label";

const LabelFormPreview = styled(Box)`
    padding: 10px;
`;

export const LabelForm = ({ color, description, errorColor, errorName, name, onChange, onColorChange, onSubmit }) => {
    const handleSubmit = e => {
        e.preventDefault();
        onSubmit(e);
    };

    const handleChange = e => {
        onChange(e.target.name, e.target.value);
    };

    return (
        <form onSubmit={handleSubmit}>
            <ModalBody>
                <InputGroup>
                    <InputLabel htmlFor="label-name">Name</InputLabel>
                    <Input id="label-name" name="name" value={name} onChange={handleChange} error={errorName} />
                    <InputError>{errorName}</InputError>
                    <InputLabel htmlFor="label-description">Description</InputLabel>
                    <Input id="label-description" name="description" value={description} onChange={handleChange} />
                </InputGroup>
                <InputGroup>
                    <InputLabel>Color</InputLabel>
                    <Color value={color} onChange={onColorChange} />
                </InputGroup>
                <label>Preview</label>
                <LabelFormPreview>
                    <SampleLabel color={color} name={name || "Preview"} />
                </LabelFormPreview>
            </ModalBody>
            <ModalFooter>
                <Button type="submit" color="blue" icon="save" name="save">
                    Save
                </Button>
            </ModalFooter>
        </form>
    );
};
