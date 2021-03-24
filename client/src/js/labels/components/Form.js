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
                    <InputLabel htmlFor="name">Name</InputLabel>
                    <Input id="name" name="name" value={name} onChange={handleChange} error={errorName} />
                    <InputError>{errorName}</InputError>
                </InputGroup>
                <InputGroup>
                    <InputLabel htmlFor="description">Description</InputLabel>
                    <Input id="description" name="description" value={description} onChange={handleChange} />
                </InputGroup>
                <InputGroup>
                    <InputLabel htmlFor="color">Color</InputLabel>
                    <Color id="color" value={color} onChange={onColorChange} />
                    <InputError>{errorColor}</InputError>
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
