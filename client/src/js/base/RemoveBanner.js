import React from "react";
import styled from "styled-components";
import { DangerAlert } from "./Alert";
import { Button } from "./Button";

const StyledRemoveBanner = styled(DangerAlert)`
    align-items: center;
    justify-content: space-between;
`;

export const RemoveBanner = ({ message, buttonText, onClick }) => (
    <StyledRemoveBanner>
        <span>{message}</span>
        <Button bsStyle="danger" onClick={onClick}>
            {buttonText}
        </Button>
    </StyledRemoveBanner>
);
