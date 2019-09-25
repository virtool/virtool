import React from "react";
import styled from "styled-components";
import { Box, Icon } from "../../../base";

const StyledBLASTError = styled(Box)`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

export const BLASTError = ({ error, onBlast }) => (
    <StyledBLASTError>
        <span>
            <strong>Error during BLAST request.</strong>
            <span> {error}</span>
        </span>
        <a href="#" onClick={onBlast}>
            <Icon name="redo" /> Retry
        </a>
    </StyledBLASTError>
);
