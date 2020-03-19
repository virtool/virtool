import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../app/actions";
import { Box, Button, Icon, LinkButton, SearchInput, Toolbar } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { clearSampleSelection, findSamples } from "../actions";
import AlgorithmFilter from "./AlgorithmFilter";

const StyledSampleSelectionToolbar = styled(Box)`
    height: 185px;
    margin-bottom: 15px;
`;

const SampleSelectionToolbarTop = styled.div`
    align-items: center;
    display: flex;

    button {
        margin-left: auto;
    }
`;

const SampleSelectionToolbar = ({ onClear, onQuickAnalyze, selected }) => (
    <StyledSampleSelectionToolbar>
        <SampleSelectionToolbarTop>
            <span>
                <Icon name="times-circle" onClick={onClear} />
                <span> {selected.length} samples selected</span>
            </span>
            <Button bsStyle="success" icon="chart-area" onClick={() => onQuickAnalyze(selected)}>
                Quick Analyze
            </Button>
        </SampleSelectionToolbarTop>
    </StyledSampleSelectionToolbar>
);

export const SampleSearchToolbar = ({ canCreate, onFind, term, pathoscope, nuvs }) => {
    let createButton;

    if (canCreate) {
        createButton = (
            <LinkButton to={{ state: { createSample: true } }} tip="Create">
                <Icon name="plus-square fa-fw" />
            </LinkButton>
        );
    }

    return (
        <div>
            <Toolbar>
                <SearchInput
                    value={term}
                    onChange={e => onFind(e.target.value, pathoscope, nuvs)}
                    placeholder="Sample name"
                />
                {createButton}
            </Toolbar>

            <Box>
                <AlgorithmFilter />
            </Box>
        </div>
    );
};

const SampleToolbar = props => {
    if (props.selected.length) {
        return <SampleSelectionToolbar {...props} />;
    }

    return <SampleSearchToolbar {...props} />;
};

const mapStateToProps = state => {
    const { term, nuvsCondition, pathoscopeCondition, selected } = state.samples;
    return {
        term,
        selected,
        nuvs: nuvsCondition,
        pathoscope: pathoscopeCondition,
        canCreate: checkAdminOrPermission(state, "create_sample")
    };
};

const mapDispatchToProps = dispatch => ({
    onFind: (term, pathoscope, nuvs) => {
        dispatch(findSamples(term, 1, pathoscope, nuvs));
    },
    onClear: () => {
        dispatch(clearSampleSelection());
    },
    onSelect: sampleId => {
        dispatch(toggleSelectSample(sampleId));
    },
    onQuickAnalyze: selected => {
        dispatch(pushState({ createAnalysis: selected }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleToolbar);
