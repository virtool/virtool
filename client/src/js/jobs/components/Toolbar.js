/**
 * JobsToolbar module
 * @module jobs/Toolbar
 */
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { InputGroup, FormGroup, FormControl } from "react-bootstrap";
import { checkAdminOrPermission } from "../../utils/utils";
import { clearJobs, findJobs } from "../actions";
import { Icon, Button, Toolbar, ButtonDropDown, DropDownItem } from "../../base";

/**
 * A toolbar component for the jobs list view.
 * @param props
 * @returns {*}
 */
const StyledToolbar = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
`;

export const JobsToolbar = ({ onClear, onFind, canRemove, term }) => {
    let removalDropdown;

    if (canRemove) {
        removalDropdown = (
            <StyledToolbar>
                <Button onClick={() => onClear("finished")} tip="Clear Finished">
                    <Icon name="trash" />
                </Button>

                <ButtonDropDown menuName=<Icon name="sort-down" size="sm" /> right="35px" top="170px">
                    <DropDownItem onClick={() => onClear("failed")}>Failed</DropDownItem>
                    <DropDownItem onClick={() => onClear("complete")}>Complete</DropDownItem>
                </ButtonDropDown>
            </StyledToolbar>
        );
    }

    return (
        <Toolbar>
            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name="search" />
                    </InputGroup.Addon>
                    <FormControl value={term} onChange={onFind} placeholder="User or task" />
                </InputGroup>
            </FormGroup>

            {removalDropdown}
        </Toolbar>
    );
};

export const mapStateToProps = state => ({
    term: state.jobs.term,
    canRemove: checkAdminOrPermission(state, "remove_job")
});

export const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findJobs(e.target.value, 1));
    },

    onClear: scope => {
        dispatch(clearJobs(scope));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(JobsToolbar);
