import React, { useCallback } from "react";
import styled from "styled-components";
import { Button, Input, InputGroup, InputLabel, InputError } from "../../base";

const colors = ["#1DAD57", "#F7A000", "#FFE030", "#E0282E", "#9F7AEA", "#0B7FE5", "#3C8786"];

const ColorSelectorButton = styled(Button)`
    background-color: ${props => props.color};
    margin-left: 5px;
`;

const ColorSelectorInputContainer = styled.div`
    display: flex;
    align-items: stretch;
`;

export const ColorSelector = ({ color, errorColor, onColorChange }) => {
    const handleChange = useCallback(e => {
        onColorChange(e.target.value);
    });

    const handleButtonChange = useCallback(color => {
        onColorChange(color);
    });

    const colorSelectors = colors.map(color => (
        <ColorSelectorButton key={color} color={color} onClick={() => handleButtonChange(color)} />
    ));

    return (
        <InputGroup>
            <InputLabel htmlFor="label-color">Color</InputLabel>
            <ColorSelectorInputContainer>
                <Input placeholder="#D3D3D3" id="label-color" name="color" value={color} onChange={handleChange} />
                {colorSelectors}
            </ColorSelectorInputContainer>
            <InputError>{errorColor}</InputError>
        </InputGroup>
    );
};
