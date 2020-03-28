import React from "react";
import styled from "styled-components";
import { Alert } from "./Alert";
import { Button } from "./Button";

const StyledRemoveBanner = styled(Alert)`
    align-items: center;
    justify-content: space-between;
`;

export const RemoveBanner = ({ message, buttonText, onClick }) => (
    <StyledRemoveBanner color="red">
        <span>{message}</span>
        <Button color="red" onClick={onClick}>
            {buttonText}
        </Button>
    </StyledRemoveBanner>
);
