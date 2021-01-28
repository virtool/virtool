import React, { useCallback } from "react";
import styled from "styled-components";
import { Button, Input, InputGroup, InputLabel, InputError } from "../../base";

const colors = ["#1DAD57", "#F7A000", "#FFE030", "#E0282E", "#9F7AEA", "#0B7FE5", "#3C8786"];

const ColorSelectorButton = styled(Button)`
    background-color: ${props => props.color};
    margin: 0 2px;
`;

const ColorSelectorInput = styled(Input)`
    width: 40%;
`;

export const ColorSelector = ({ color, errorColor, onColorChange }) => {
    const handleChange = useCallback(e => {
        onColorChange(e.target.value);
    });

    const handleButtonChange = useCallback(color => {
        onColorChange(color);
    });

    const colorSelectors = colors.map(color => (
        <ColorSelectorButton key={color} color={color} onClick={() => handleButtonChange(color)}></ColorSelectorButton>
    ));

    return (
        <InputGroup>
            <InputLabel>Select a color</InputLabel>
            <div>{colorSelectors}</div>
            <InputLabel>or enter a custom color </InputLabel>
            <ColorSelectorInput placeholder="#D3D3D3" name="color" value={color} onChange={handleChange} />
            <InputError>{errorColor}</InputError>
        </InputGroup>
    );
};
