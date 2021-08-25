import React from "react";
import styled from "styled-components";
import { borderRadius, boxShadow } from "../../../../app/theme";
import { Box } from "../../../../base";
import SampleLabels from "./Labels";
import DefaultSubtractions from "./Subtractions";

const StyledSidebar = styled(Box)`
    align-items: stretch;
    background-color: ${props => props.theme.color.greyLightest};
    border: none;
    border-radius: ${borderRadius.md};
    box-shadow: ${boxShadow.sm};
    flex-direction: column;
    display: flex;
    width: 320px;
`;

export const Sidebar = () => (
    <StyledSidebar>
        <SampleLabels />
        <DefaultSubtractions />
    </StyledSidebar>
);
