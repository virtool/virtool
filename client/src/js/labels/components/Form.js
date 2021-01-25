import React from "react";
import { Button, Input, InputError, InputGroup, InputLabel } from "../../base";
import { ColorSelector } from "./ColorSelector";

export const LabelForm = ({ color, description, errorColor, errorName, name, onChange, onColorChange, onSubmit }) => (
    <form onSubmit={onSubmit}>
        <InputGroup>
            <InputLabel>Name</InputLabel>
            <Input name="labelName" value={name} onChange={onChange} error={errorName} />
            <InputError>{errorName}</InputError>
            <InputLabel>Description</InputLabel>
            <Input name="description" value={description} onChange={onChange} />
        </InputGroup>
        <ColorSelector color={color} errorColor={errorColor} onColorChange={onColorChange} />
        <Button type="submit" color="blue">
            Create
        </Button>
    </form>
);
