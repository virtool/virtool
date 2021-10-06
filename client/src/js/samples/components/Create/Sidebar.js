import React from "react";
import styled from "styled-components";
import SampleLabels from "../LabelSidebar/Labels";
import { SideContainer } from "../../../base";
const StyledSidebar = styled(SideContainer)`
    align-items: stretch;
    flex-direction: column;
    display: flex;
    width: 320px;
    z-index: 0;
    padding-left: 15px;
`;

export const Sidebar = ({ sampleLabels, onUpdate }) => (
    <StyledSidebar>
        <SampleLabels sampleId="0" onUpdate={onUpdate} sampleLabels={sampleLabels} />
    </StyledSidebar>
);
