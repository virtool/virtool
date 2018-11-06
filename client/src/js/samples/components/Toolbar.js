import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";

import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { checkAdminOrPermission } from "../../utils/utils";
import { Icon, Button } from "../../base";
import { findSamples } from "../actions";

export const SampleToolbar = ({ canCreate, onFind, term }) => {
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

const mapStateToProps = state => ({
    term: state.samples.term,
    canCreate: checkAdminOrPermission(state, "create_sample")
});

const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findSamples(e.target.value, 1));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleToolbar);
