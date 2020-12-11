import React from "react";
import styled from "styled-components";
import { Button, Input, InputGroup, InputLabel, InputError } from "../../../base";

export const StyledColorButton = styled(Button)`
    background-color: ${props => props.color};
    margin: 0px 2px;
`;

export const StyledInput = styled(Input)`
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
            color
        });
        this.props.onColorChange({ color });
    };

    render() {
        const color = this.state.color;
        return (
            <InputGroup>
                <InputLabel>Select a color</InputLabel>
                <div>
                    <StyledColorButton
                        name="color"
                        color="green"
                        onClick={() => this.handleButtonChange("#1DAD57")}
                    ></StyledColorButton>
                    <StyledColorButton
                        name="color"
                        color="orange"
                        onClick={() => this.handleButtonChange("#F7A000")}
                    ></StyledColorButton>
                    <StyledColorButton
                        name="color"
                        color="yellow"
                        onClick={() => this.handleButtonChange("#FFE030")}
                    ></StyledColorButton>
                    <StyledColorButton
                        name="color"
                        color="red"
                        onClick={() => this.handleButtonChange("#E0282E")}
                    ></StyledColorButton>
                    <StyledColorButton
                        name="color"
                        color="purple"
                        onClick={() => this.handleButtonChange("#9F7AEA")}
                    ></StyledColorButton>
                    <StyledColorButton
                        name="color"
                        color="blue"
                        onClick={() => this.handleButtonChange("#0B7FE5")}
                    ></StyledColorButton>
                    <StyledColorButton
                        name="color"
                        color="primary"
                        onClick={() => this.handleButtonChange("#3C8786")}
                    ></StyledColorButton>
                </div>
                <InputLabel>or enter a custom color </InputLabel>
                <StyledInput
                    placeholder="Ex. #D3D3D3"
                    name="color"
                    value={color}
                    onChange={this.handleChange}
                    error={this.props.errorColor}
                ></StyledInput>
                <InputError>{this.props.errorColor}</InputError>
            </InputGroup>
        );
    }
}
