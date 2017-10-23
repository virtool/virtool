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
import { get } from "lodash";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Route, Switch } from "react-router-dom";
import { Col, FormControl, FormGroup, InputGroup, Row  } from "react-bootstrap";
import { ClipLoader } from "halogenium";

import { listUsers, filterUsers } from "../actions";
import { listGroups } from "../../groups/actions";
import { Button, Icon } from "../../base";
import UsersList from "./List";
import CreateUser from "./Create";
import Groups from "../../groups/components/Groups";

class ManageUsers extends React.Component {

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

    render () {

        if (this.props.users === null || this.props.groups === null) {
            return (
                <div className="text-center" style={{margin: "220px auto"}}>
                    <ClipLoader color="#3c8786" />
                </div>
            );
        }

        return (
            <div>
                <Row>
                    <Col xs={12}>
                        <div className="toolbar">
                            <FormGroup>
                                <InputGroup>
                                    <InputGroup.Addon>
                                        <Icon name="search"/>
                                    </InputGroup.Addon>
                                    <FormControl
                                        type="text"
                                        value={this.props.filter}
                                        onChange={(e) => this.props.onFilter(e.target.value)}
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
                            <Route path="/settings/users" component={UsersList} exact />
                            <Route path="/settings/users/:activeId" component={UsersList} />
                        </Switch>
                    </Col>
                </Row>

                <Route path="/settings/users" render={({ location }) => {
                    return (
                        <div>
                            <CreateUser
                                show={get(location.state, "createUser")}
                                onHide={this.props.onHide}
                            />

                            <Groups
                                show={get(location.state, "groups")}
                                onHide={this.props.onHide}
                            />
                        </div>
                    );
                }} />
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        users: state.users.list,
        groups: state.groups.list,
        filter: state.users.filter
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onListUsers: () => {
            dispatch(listUsers());
        },

        onListGroups: () => {
            dispatch(listGroups());
        },

        onFilter: (term) => {
            dispatch(filterUsers(term));
        },

        onHide: () => {
            dispatch(push({state: {groups: false, createUser: false}}));
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(ManageUsers);

export default Container;
