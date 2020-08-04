import React from "react";
import styled from "styled-components";
import { Alert } from "./Alert";
import { Button } from "./Button";

const StyledRemoveBanner = styled(Alert)`
    align-items: center;
    justify-content: space-between;

    span:first-child {
        font-weight: ${props => props.theme.fontWeight.thick};

        strong {
            font-weight: ${props => props.theme.fontWeight.bold};
        }
    }
`;

export const RemoveBanner = ({ message, buttonText, onClick }) => (
    <StyledRemoveBanner color="red">
        <strong>{message}</strong>
        <Button color="red" icon="trash" onClick={onClick}>
            {buttonText}
        </Button>
    </StyledRemoveBanner>
);
