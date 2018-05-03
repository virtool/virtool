/**
 * JobsToolbar module
 * @module jobs/Toolbar
 */
import React from "react";
import { connect } from "react-redux";
import { InputGroup, FormGroup, FormControl, Dropdown, MenuItem } from "react-bootstrap";

import { clearJobs } from "../actions";
import { Icon, Button } from "../../base";
import { push } from "react-router-redux";
import { createFindURL, getFindTerm } from "../../utils";

/**
 * A toolbar component for the jobs list view.
 * @param props
 * @returns {*}
 */
const JobsToolbar = (props) => {

    let removalDropdown;

    if (props.canRemove) {
        removalDropdown = (
            <Dropdown id="job-clear-dropdown" className="split-dropdown" pullRight>
                <Button onClick={() => props.onClear()} tip="Clear Finished">
                    <Icon name="trash" />
                </Button>
                <Dropdown.Toggle />
                <Dropdown.Menu>
                    <MenuItem eventKey="removeFailed" onClick={() => props.onClear("failed")}>
                        Failed
                    </MenuItem>
                    <MenuItem eventKey="removeComplete" onClick={() => props.onClear("complete")}>
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
                    <FormControl value={props.term} onChange={(e) => props.onFind(e.target.value)} />
                </InputGroup>
            </FormGroup>

            {removalDropdown}
        </div>
    );
};

const mapStateToProps = (state) => ({
    term: getFindTerm(),
    canRemove: state.account.permissions.remove_job
});

const mapDispatchToProps = (dispatch) => ({

    onFind: (find) => {
        const url = createFindURL({ find });
        dispatch(push(url.pathname + url.search));
    },

    onClear: (scope) => {
        dispatch(clearJobs(scope));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(JobsToolbar);
