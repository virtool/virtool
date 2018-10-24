/**
 * JobsToolbar module
 * @module jobs/Toolbar
 */
import React from "react";
import { connect } from "react-redux";
import {
  InputGroup,
  FormGroup,
  FormControl,
  Dropdown,
  MenuItem
} from "react-bootstrap";
import { clearJobs, filterJobs } from "../actions";
import { Icon, Button } from "../../base";

/**
 * A toolbar component for the jobs list view.
 * @param props
 * @returns {*}
 */
const JobsToolbar = props => {
  let removalDropdown;

  if (props.canRemove) {
    removalDropdown = (
      <Dropdown id="job-clear-dropdown" className="split-dropdown" pullRight>
        <Button name="finished" onClick={props.onClear} tip="Clear Finished">
          <Icon name="trash" />
        </Button>
        <Dropdown.Toggle />
        <Dropdown.Menu>
          <MenuItem
            eventKey="removeFailed"
            name="failed"
            onClick={props.onClear}
          >
            Failed
          </MenuItem>
          <MenuItem
            eventKey="removeComplete"
            name="complete"
            onClick={props.onClear}
          >
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
          <FormControl
            value={props.filter}
            onChange={props.onFilter}
            placeholder="User or task"
          />
        </InputGroup>
      </FormGroup>

      {removalDropdown}
    </div>
  );
};

const mapStateToProps = state => ({
  filter: state.jobs.filter
});

const mapDispatchToProps = dispatch => ({
  onFilter: e => {
    dispatch(filterJobs(e.target.value));
  },

  onClear: e => {
    dispatch(clearJobs(e.target.name));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(JobsToolbar);
