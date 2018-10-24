/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Users
 */

import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Col, FormControl, FormGroup, InputGroup, Row } from "react-bootstrap";
import { get } from "lodash-es";
import { filterUsers } from "../actions";
import { clearError } from "../../errors/actions";
import { Button, Icon, LoadingPlaceholder, Alert } from "../../base";
import Groups from "../../groups/components/Groups";
import { listGroups } from "../../groups/actions";
import UsersList from "./List";
import CreateUser from "./Create";

export class ManageUsers extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      filter: this.props.filter,
      error: ""
    };
  }

  componentDidMount() {
    if (!this.props.groupsFetched) {
      this.props.onListGroups();
    }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (!nextProps.isAdmin && prevState.error !== nextProps.error) {
      return { error: nextProps.error };
    }
    return null;
  }

  componentWillUnmount() {
    if (this.props.error.length) {
      this.props.onClearError("LIST_USERS_ERROR");
    }
  }

  handleFilter = e => {
    e.preventDefault();
    this.setState({ filter: e.target.value });
    this.props.onFilter(e.target.value);
  };

  render() {
    if (this.state.error.length) {
      return (
        <Alert bsStyle="warning" icon="warning">
          <strong>You do not have permission to manage users.</strong>
          <span> Contact an administrator.</span>
        </Alert>
      );
    }

    if (this.props.groups === null) {
      return <LoadingPlaceholder margin="220px" />;
    }

    return (
      <div>
        <Row>
          <Col xs={12}>
            <div className="toolbar">
              <FormGroup>
                <InputGroup>
                  <InputGroup.Addon>
                    <Icon name="search" />
                  </InputGroup.Addon>
                  <FormControl
                    type="text"
                    value={this.state.filter}
                    onChange={this.handleFilter}
                  />
                </InputGroup>
              </FormGroup>

              <LinkContainer to={{ state: { groups: true } }}>
                <Button icon="users" tip="Manage Groups" />
              </LinkContainer>

              <LinkContainer to={{ state: { createUser: true } }}>
                <Button bsStyle="primary" icon="user-plus" tip="Create User" />
              </LinkContainer>
            </div>
          </Col>
          <Col xs={12}>
            <UsersList />
          </Col>
        </Row>

        <CreateUser />
        <Groups />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  isAdmin: state.account.administrator,
  filter: state.users.filter,
  groups: state.groups.list,
  groupsFetched: state.groups.fetched,
  error: get(state, "errors.LIST_USERS_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
  onFilter: term => {
    dispatch(filterUsers(term));
  },

  onClearError: error => {
    dispatch(clearError(error));
  },

  onListGroups: () => {
    dispatch(listGroups());
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ManageUsers);
