import React from "react";
import { connect } from "react-redux";
import { Icon, LinkButton } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { findReferences } from "../actions";

export const ReferenceToolbar = ({ term, onFind, canCreate }) => {
    let createButton;

    if (canCreate) {
        createButton = (
            <LinkButton to={{ state: { newReference: true, createReference: true } }} tip="Create">
                <Icon name="plus-square fa-fw" />
            </LinkButton>
        );
    }

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
