/**
 * JobsToolbar module
 * @module jobs/Toolbar
 */
import React from "react";
import { connect } from "react-redux";
import { InputGroup, FormGroup, FormControl, Dropdown, MenuItem } from "react-bootstrap";
import { checkAdminOrPermission } from "../../utils";
import { clearJobs, findJobs } from "../actions";
import { Icon, Button } from "../../base";

/**
 * A toolbar component for the jobs list view.
 * @param props
 * @returns {*}
 */
const JobsToolbar = ({ onClear, onFind, canRemove, term }) => {
    let removalDropdown;

    if (canRemove) {
        removalDropdown = (
            <Dropdown id="job-clear-dropdown" className="split-dropdown" pullRight>
                <Button name="finished" onClick={onClear} tip="Clear Finished">
                    <Icon name="trash" />
                </Button>
                <Dropdown.Toggle />
                <Dropdown.Menu>
                    <MenuItem eventKey="removeFailed" name="failed" onClick={onClear}>
                        Failed
                    </MenuItem>
                    <MenuItem eventKey="removeComplete" name="complete" onClick={onClear}>
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

const mapStateToProps = state => ({
    term: state.jobs.term,
    canRemove: checkAdminOrPermission(state, "remove_job")
});

const mapDispatchToProps = dispatch => ({
    onFind: e => {
        dispatch(findJobs(e.target.value, 1));
    },

    onClear: e => {
        dispatch(clearJobs(e.target.name));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(JobsToolbar);
