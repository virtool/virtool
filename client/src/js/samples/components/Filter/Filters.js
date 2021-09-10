import React from "react";
import styled from "styled-components";
import LabelFilter from "./LabelFilter";
import WorkflowFilter from "./WorkflowFilter";

const StyledSampleFilters = styled.div`
    grid-column: 2;
    grid-row: 2;
`;

export const SampleFilters = () => (
    <StyledSampleFilters>
        <LabelFilter />
        <WorkflowFilter />
    </StyledSampleFilters>
);
