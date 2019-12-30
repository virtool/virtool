import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { Button, Icon } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { findSubtractions } from "../actions";

export const SubtractionToolbar = ({ term, onFind, canModify }) => {
    let createButton;

    if (canModify) {
        createButton = (
            <LinkContainer to={{ state: { createSubtraction: true } }}>
                <Button bsStyle="primary" icon="plus-square fa-fw" tip="Create" />
            </LinkContainer>
        );
    }

    return (
        <div key="toolbar" className="toolbar">
            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name="search" />
                    </InputGroup.Addon>
                    <FormControl type="text" value={term} onChange={onFind} placeholder="Name" />
                </InputGroup>
            </FormGroup>

            {createButton}
        </div>
    );
};

const mapStateToProps = state => ({
    term: state.subtraction.term || "",
    canModify: checkAdminOrPermission(state, "modify_subtraction")
});

const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findSubtractions(e.target.value || null, 1));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SubtractionToolbar);
