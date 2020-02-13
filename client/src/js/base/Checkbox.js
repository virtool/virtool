import React from "react";
import styled from "styled-components";
import { CustomCheckboxContainer, CustomCheckboxInput } from "@reach/checkbox";
import { Icon } from "./Icon";

const CheckIcon = styled(Icon)`
    font-size: 8px;
    color: ${props => (props.checked ? "white" : "1px solid grey")};
`;

const StyledContainer = styled(CustomCheckboxContainer)`
    display: inline-flex;
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
            <StyledContainer checked={this.props.checked}>
                <CheckIcon checked={this.props.checked} name="check" />
                <StyledInput />
            </StyledContainer>
        );
    }
}
