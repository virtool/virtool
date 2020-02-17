import React from "react";
import { FormControl, FormGroup, InputGroup, ListGroup, ListGroupItem } from "react-bootstrap";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { Button, Flex, FlexItem, Icon, LinkButton, Toolbar } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { clearSampleSelection, findSamples } from "../actions";
import AlgorithmFilter from "./AlgorithmFilter";

const SampleSelectionToolbar = ({ onClear, onQuickAnalyze, selected }) => (
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
                <FormGroup>
                    <InputGroup>
                        <InputGroup.Addon>
                            <Icon name="search fa-fw" />
                        </InputGroup.Addon>
                        <FormControl
                            type="text"
                            value={term}
                            onChange={e => onFind(e.target.value, pathoscope, nuvs)}
                            placeholder="Sample name"
                        />
                    </InputGroup>
                </FormGroup>
                {createButton}
            </Toolbar>
            <ListGroup style={{ marginBottom: "7px" }}>
                <ListGroupItem>
                    <AlgorithmFilter />
                </ListGroupItem>
            </ListGroup>
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
