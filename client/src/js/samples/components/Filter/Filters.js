import React from "react";
import styled from "styled-components";
import { Box, BoxTitle } from "../../../base";
import LabelFilter from "./LabelFilter";
import WorkflowFilter from "./WorkflowFilter";

const StyledSampleFilters = styled.div`
    padding-left: 15px;
    width: 320px;
`;

export const SampleFilters = () => (
    <StyledSampleFilters>
        <Box>
            <BoxTitle>Labels</BoxTitle>
            <LabelFilter />
        </Box>
        <WorkflowFilter />
    </StyledSampleFilters>
);
