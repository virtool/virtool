import React from "react";
import { push } from "connected-react-router";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";

import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { checkAdminOrPermission } from "../../utils/utils";
import { Icon, Button, Flex, FlexItem } from "../../base";
import { clearSampleSelection, findSamples } from "../actions";

const SampleSelectionToolbar = ({ onClear, onQuickAnalyze, onSelect, selected }) => (
    <Flex alignItems="stretch" style={{ marginBottom: "15px" }}>
        <FlexItem grow={1}>
            <div className="sample-selection-toolbar">
                <button type="button" className="close" onClick={onClear} style={{ padding: "0 10px 0 12px" }}>
                    <span>×</span>
                </button>
                <span>{selected.length} samples selected</span>
            </div>
        </FlexItem>
        <FlexItem>
            <Button
                bsStyle="success"
                icon="chart-area"
                style={{ height: "100%" }}
                onClick={() => onQuickAnalyze(selected)}
            />
        </FlexItem>
    </Flex>
);

export const SampleSearchToolbar = ({ canCreate, onFind, term }) => {
    let createButton;

    if (canCreate) {
        createButton = (
            <LinkContainer to={{ state: { createSample: true } }}>
                <Button tip="Create" icon="plus-square fa-fw" bsStyle="primary" />
            </LinkContainer>
        );
    }

    return (
        <div key="toolbar" className="toolbar">
            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name="search fa-fw" />
                    </InputGroup.Addon>
                    <FormControl type="text" value={term} onChange={onFind} placeholder="Sample name" />
                </InputGroup>
            </FormGroup>
            {createButton}
        </div>
    );
};

const SampleToolbar = props => {
    if (props.selected.length) {
        return <SampleSelectionToolbar {...props} />;
    }

    return <SampleSearchToolbar {...props} />;
};

const mapStateToProps = state => ({
    term: state.samples.term,
    selected: state.samples.selected,
    canCreate: checkAdminOrPermission(state, "create_sample")
});

const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findSamples(e.target.value, 1));
    },
    onClear: () => {
        dispatch(clearSampleSelection());
    },
    onSelect: sampleId => {
        dispatch(toggleSelectSample(sampleId));
    },
    onQuickAnalyze: selected => {
        dispatch(push({ state: { createAnalysis: selected } }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleToolbar);
