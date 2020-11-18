import React from "react";
import styled from "styled-components";
import { Button, Input, InputGroup, InputLabel } from "../../../base";

export const ColorButton = styled(Button)`
    background-color: ${props => props.color};
    margin: 0px 2px;
`;

export const ColorInput = styled(Input)`
    width: 40%;
`;

const getInitialState = ({ color }) => ({
    color: color || ""
});

export class ColorSelector extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({
            [name]: value,
            error: ""
        });
        this.props.onColorChange({ color: value });
    };

    handleButtonChange = color => {
        this.setState({
            color: color
        });
        this.props.onColorChange({ color: color });
    };

    render() {
        return (
            <InputGroup>
                <InputLabel>Select a color</InputLabel>
                <div>
                    <ColorButton color="green" onClick={() => this.handleButtonChange("green")}></ColorButton>
                    <ColorButton color="orange" onClick={() => this.handleButtonChange("orange")}></ColorButton>
                    <ColorButton color="yellow" onClick={() => this.handleButtonChange("yellow")}></ColorButton>
                    <ColorButton color="red" onClick={() => this.handleButtonChange("red")}></ColorButton>
                    <ColorButton color="purple" onClick={() => this.handleButtonChange("purple")}></ColorButton>
                    <ColorButton color="blue" onClick={() => this.handleButtonChange("blue")}></ColorButton>
                    <ColorButton color="primary" onClick={() => this.handleButtonChange("primary")}></ColorButton>
                </div>
                <InputLabel>or enter a custom color </InputLabel>
                <ColorInput placeholder="Ex. #D3D3D3" name="color" onChange={this.handleChange}></ColorInput>
            </InputGroup>
        );
    }
}
