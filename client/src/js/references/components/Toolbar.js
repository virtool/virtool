import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Icon, Button } from "../../base";
import { checkAdminOrPermission } from "../../utils";
import { findReferences } from "../actions";

const ReferenceToolbar = ({ term, onFind, canCreate }) => {
    let createButton;

    if (canCreate) {
        createButton = (
            <LinkContainer to={{ state: { newReference: true, createReference: true } }}>
                <Button bsStyle="primary" tip="Create" icon="plus-square fa-fw" />
            </LinkContainer>
        );
    }

    console.log(term);

    return (
        <div className="toolbar">
            <div className="form-group">
                <div className="input-group">
                    <span id="find-addon" className="input-group-addon">
                        <Icon name="search" />
                    </span>
                    <input
                        aria-describedby="find-addon"
                        className="form-control"
                        type="text"
                        placeholder="Reference name"
                        value={term}
                        onChange={onFind}
                    />
                </div>
            </div>
            {createButton}
        </div>
    );
};

const mapStateToProps = state => ({
    canCreate: checkAdminOrPermission(state, "create_ref"),
    term: state.references.term
});

const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findReferences(e.target.value));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ReferenceToolbar);
