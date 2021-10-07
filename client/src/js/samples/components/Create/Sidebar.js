import React from "react";
import styled from "styled-components";
import { SideContainer } from "../../../base";
import SampleLabels from "../LabelSidebar/Labels";

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
