import React from "react";
import { connect } from "react-redux";
import { LinkButton, SearchInput, Toolbar } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { findSubtractions } from "../actions";

export const SubtractionToolbar = ({ term, onFind, canModify }) => {
    let createButton;

    if (canModify) {
        createButton = <LinkButton color="blue" to="subtraction/create" icon="plus-square" tip="Create" />;
    }

    return (
        <Toolbar>
            <SearchInput value={term} onChange={onFind} placeholder="Name" />
            {createButton}
        </Toolbar>
    );
};

export const mapStateToProps = state => ({
    term: state.subtraction.term || "",
    canModify: checkAdminOrPermission(state, "modify_subtraction")
});

export const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findSubtractions(e.target.value || null, 1));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SubtractionToolbar);
