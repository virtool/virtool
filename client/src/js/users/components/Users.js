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
import { Route, Switch } from "react-router-dom";
import { Col, FormControl, FormGroup, InputGroup, Row } from "react-bootstrap";

import { listUsers, filterUsers } from "../actions";
import { listGroups } from "../../groups/actions";
import { Button, Icon, LoadingPlaceholder } from "../../base";
import UsersList from "./List";
import CreateUser from "./Create";
import Groups from "../../groups/components/Groups";

export class ManageUsers extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            filter: ""
        };
    }

    componentWillMount () {
        if (this.props.users === null) {
            this.props.onListUsers();
        }

        if (this.props.groups === null) {
            this.props.onListGroups();
        }
    }

    handleFilter = (e) => {
        this.props.onFilter(e.target.value);
    }

    handlePermissionChanges = () => {
        this.props.onListUsers();
    }

    render () {

        if (this.props.users === null || this.props.groups === null) {
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
                                        value={this.props.filter}
                                        onChange={this.handleFilter}
                                    />
                                </InputGroup>
                            </FormGroup>

                            <LinkContainer to={{state: {groups: true}}}>
                                <Button icon="users" tip="Manage Groups" />
                            </LinkContainer>

                            <LinkContainer to={{state: {createUser: true}}}>
                                <Button bsStyle="primary" icon="user-plus" tip="Create User" />
                            </LinkContainer>
                        </div>
                    </Col>
                    <Col xs={12}>
                        <Switch>
                            <Route path="/administration/users" component={UsersList} exact />
                            <Route path="/administration/users/:activeId" component={UsersList} />
                        </Switch>
                    </Col>
                </Row>

                <CreateUser />
                <Groups updatePermissions={this.handlePermissionChanges} />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    users: state.users.list,
    groups: state.groups.list,
    filter: state.users.filter
});

const mapDispatchToProps = dispatch => ({

    onListUsers: () => {
        dispatch(listUsers());
    },

    onListGroups: () => {
        dispatch(listGroups());
    },

    onFilter: (term) => {
        dispatch(filterUsers(term));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ManageUsers);
