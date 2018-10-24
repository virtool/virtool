import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";

import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { checkAdminOrPermission } from "../../utils";
import { Icon, Button } from "../../base";
import { findSamples } from "../actions";

const SampleToolbar = ({ canCreate, onFilter, filter }) => (
  <div key="toolbar" className="toolbar">
    <FormGroup>
      <InputGroup>
        <InputGroup.Addon>
          <Icon name="search fa-fw" />
        </InputGroup.Addon>
        <FormControl
          type="text"
          value={filter}
          onChange={onFilter}
          placeholder="Sample name"
        />
      </InputGroup>
    </FormGroup>

    {canCreate ? (
      <LinkContainer to={{ state: { create: true } }}>
        <Button tip="Create" icon="plus-square fa-fw" bsStyle="primary" />
      </LinkContainer>
    ) : null}
  </div>
);

const mapStateToProps = state => ({
  filter: state.samples.filter,
  canCreate: checkAdminOrPermission(
    state.account.administrator,
    state.account.permissions,
    "create_sample"
  )
});

const mapDispatchToProps = dispatch => ({
  onFilter: e => {
    dispatch(findSamples(e.target.value));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SampleToolbar);
