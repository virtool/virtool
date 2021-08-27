import React from "react";
import styled from "styled-components";
import { Box } from "../../../../base";
import SampleLabels from "./Labels";
import DefaultSubtractions from "./Subtractions";

const StyledSidebar = styled.div`
    align-items: stretch;
    flex-direction: column;
    display: flex;
    width: 320px;
    z-index: 0;
`;

export const Sidebar = () => (
    <StyledSidebar>
        <SampleLabels />
        <DefaultSubtractions />
    </StyledSidebar>
);
