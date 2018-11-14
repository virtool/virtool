import { push } from "connected-react-router";
import React from "react";
import { connect } from "react-redux";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { Button, Icon } from "../../base";
import { getCanModify } from "../../samples/selectors";
import { findAnalyses } from "../actions";

export const AnalysesToolbar = ({ canModify, onFind, onShowCreate, page, sampleId, term }) => (
    <div className="toolbar">
        <FormGroup>
            <InputGroup>
                <InputGroup.Addon>
                    <Icon name="search" />
                </InputGroup.Addon>
                <FormControl
                    type="text"
                    value={term}
                    onChange={e => onFind(sampleId, e.target.value, page)}
                    placeholder="User or reference"
                />
            </InputGroup>
        </FormGroup>
        <Button
            icon="plus-square fa-fw"
            tip="New Analysis"
            bsStyle="primary"
            onClick={() => onShowCreate(sampleId)}
            disabled={!canModify}
        />
    </div>
);

const mapStateToProps = state => ({
    sampleId: state.samples.detail.id,
    term: state.analyses.term,
    canModify: getCanModify(state)
});

const mapDispatchToProps = dispatch => ({
    onShowCreate: sampleId => {
        dispatch(push({ ...window.location, state: { createAnalysis: [sampleId] } }));
    },
    onFind: (sampleId, term, page) => {
        dispatch(findAnalyses(sampleId, term, page));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AnalysesToolbar);
