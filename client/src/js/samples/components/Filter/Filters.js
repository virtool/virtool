import React from "react";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "../../../base";
import LabelFilter from "./LabelFilter";
import WorkflowFilter from "./WorkflowFilter";

const StyledSampleFilters = styled.div`
    padding-left: 15px;
    width: 320px;
`;

export const SampleFilters = () => (
    <StyledSampleFilters>
        <BoxGroup>
            <BoxGroupHeader>
                <h2>Filters</h2>
            </BoxGroupHeader>
            <BoxGroupSection>
                <label>Labels</label>
                <LabelFilter />
            </BoxGroupSection>
            <BoxGroupSection>
                <label>Workflow</label>
                <WorkflowFilter />
            </BoxGroupSection>
        </BoxGroup>
    </StyledSampleFilters>
);
