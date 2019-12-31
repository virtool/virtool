/**
 * JobsToolbar module
 * @module jobs/Toolbar
 */
import React from "react";
import { connect } from "react-redux";
import { InputGroup, FormGroup, FormControl, Dropdown, MenuItem } from "react-bootstrap";
import { checkAdminOrPermission } from "../../utils/utils";
import { clearJobs, findJobs } from "../actions";
import { Icon, Button } from "../../base";

/**
 * A toolbar component for the jobs list view.
 * @param props
 * @returns {*}
 */
export const JobsToolbar = ({ onClear, onFind, canRemove, term }) => {
    let removalDropdown;

    if (canRemove) {
        removalDropdown = (
            <Dropdown id="job-clear-dropdown" className="split-dropdown" pullRight>
                <Button onClick={() => onClear("finished")} tip="Clear Finished">
                    <Icon name="trash" />
                </Button>
                <Dropdown.Toggle />
                <Dropdown.Menu>
                    <MenuItem eventKey="failed" onSelect={onClear}>
                        Failed
                    </MenuItem>
                    <MenuItem eventKey="complete" onSelect={onClear}>
                        Complete
                    </MenuItem>
                </Dropdown.Menu>
            </Dropdown>
        );
    }

    return (
        <div className="toolbar">
            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name="search" />
                    </InputGroup.Addon>
                    <FormControl value={term} onChange={onFind} placeholder="User or task" />
                </InputGroup>
            </FormGroup>

            {removalDropdown}
        </div>
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
