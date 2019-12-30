import React from "react";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { Button, Icon, Toolbar } from "../../base";
import { getCanModify } from "../../samples/selectors";
import { findAnalyses } from "../actions";

export const AnalysesToolbar = ({ canModify, onFind, onShowCreate, page, sampleId, term }) => (
    <Toolbar>
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
    </Toolbar>
);

export const mapStateToProps = state => ({
    canModify: getCanModify(state),
    page: state.analyses.page,
    sampleId: state.samples.detail.id,
    term: state.analyses.term
});

export const mapDispatchToProps = dispatch => ({
    onShowCreate: sampleId => {
        dispatch(pushState({ createAnalysis: [sampleId] }));
    },
    onFind: (sampleId, term, page) => {
        dispatch(findAnalyses(sampleId, term, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AnalysesToolbar);
