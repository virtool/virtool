import React from "react";
import { connect } from "react-redux";
import { Button, Icon, SearchInput, Toolbar } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { clearJobs, findJobs } from "../actions";

export const JobsToolbar = ({ onClear, onFind, canRemove, term }) => (
    <Toolbar>
        <SearchInput value={term} onChange={onFind} placeholder="User or task" />
        {canRemove && (
            <Button onClick={() => onClear("finished")} tip="Clear Finished">
                <Icon name="trash" />
            </Button>
        )}
    </Toolbar>
);

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
