import React from "react";
import styled from "styled-components";
import { CustomCheckboxContainer, CustomCheckboxInput } from "@reach/checkbox";
import { Icon } from "./Icon";

const CheckIcon = styled(Icon)`
    font-size: 8px;
    color: ${props => (props.checked ? "white" : "1px solid grey")};
`;

const Label = styled.span`
    margin-left: 4px;
`;

const StyledContainer = styled.div`
    display: inline-flex;
    justify-content: center;
    align-items: center;
`;

export const StyledCheckbox = styled(CustomCheckboxContainer)`
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;

    width: 19px;
    height: 19px;

    border-radius: 50%;

    border: ${props => (props.checked ? "none" : "1px solid grey")};
    opacity: ${props => (props.checked ? 1 : 0.5)};
    background-color: ${props => (props.checked ? "teal" : "white")};
`;

const StyledInput = styled(CustomCheckboxInput)`
    display: none;
`;

export class Checkbox extends React.Component {
    render() {
        return (
            <StyledContainer>
                <StyledCheckbox checked={this.props.checked} onClick={this.props.disabled ? null : this.props.onClick}>
                    <CheckIcon checked={this.props.checked} name="check" />

                    <StyledInput />
                </StyledCheckbox>

                {this.props.label ? <Label>{this.props.label}</Label> : null}
            </StyledContainer>
        );
    }
}
