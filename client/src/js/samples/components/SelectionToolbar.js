import React from "react";
import styled from "styled-components";
import { Box, Button } from "../../base";

const SampleSelectionToolbarTop = styled.div`
    align-items: center;
    display: flex;

    button:first-child {
        align-items: center;
        display: flex;
        flex: 1;
        justify-content: flex-start;
        margin-right: 3px;
    }
`;

const StyledSampleSelectionToolbar = styled(Box)`
    height: 185px;
    margin-bottom: 15px;
`;

export const SampleSelectionToolbar = ({ onClear, onQuickAnalyze, selected }) => (
    <StyledSampleSelectionToolbar>
        <SampleSelectionToolbarTop>
            <Button icon="times-circle" onClick={onClear}>
                Clear selection of {selected.length} samples
            </Button>
            <Button color="green" icon="chart-area" onClick={() => onQuickAnalyze(selected)}>
                Quick Analyze
            </Button>
        </SampleSelectionToolbarTop>
    </StyledSampleSelectionToolbar>
);
