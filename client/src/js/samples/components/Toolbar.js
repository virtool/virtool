import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { Box, Icon, LinkButton, SearchInput, Toolbar } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { clearSampleSelection, findSamples } from "../actions";
import { SampleSelectionToolbar } from "./SelectionToolbar";
import WorkflowFilter from "./WorkflowFilter";

export const SampleSearchToolbar = ({ canCreate, nuvs, pathoscope, term, onFind }) => {
    let createButton;

    if (canCreate) {
        createButton = (
            <LinkButton to="/samples/create" color="blue" tip="Create">
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
                <WorkflowFilter />
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
    onQuickAnalyze: () => {
        dispatch(pushState({ quickAnalysis: true }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleToolbar);
