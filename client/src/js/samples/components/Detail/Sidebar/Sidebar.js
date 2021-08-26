import React from "react";
import styled from "styled-components";
import { Box } from "../../../../base";
import SampleLabels from "./Labels";
import DefaultSubtractions from "./Subtractions";

const StyledSidebar = styled(Box)`
    align-items: stretch;
    border: none;
    flex-direction: column;
    display: flex;
    width: 320px;
    padding-top: 0px;
`;

export const Sidebar = () => (
    <StyledSidebar>
        <SampleLabels />
        <DefaultSubtractions />
    </StyledSidebar>
);
