import React from "react";
import styled from "styled-components";
import { SideContainer } from "../../../base";
import SampleLabels from "../Sidebar/Labels";
import DefaultSubtractions from "../Sidebar/Subtractions";

const StyledSidebar = styled(SideContainer)`
    align-items: stretch;
    flex-direction: column;
    display: flex;
    width: 320px;
    z-index: 0;
    padding-left: 15px;
`;

export const Sidebar = ({ sampleLabels, defaultSubtractions, onUpdate }) => (
    <StyledSidebar>
        <SampleLabels onUpdate={selection => onUpdate("labels", selection)} sampleLabels={sampleLabels} />
        <DefaultSubtractions
            onUpdate={selection => onUpdate("subtractionIds", selection)}
            defaultSubtractions={defaultSubtractions}
        />
    </StyledSidebar>
);
