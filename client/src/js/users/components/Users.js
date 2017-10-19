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
import { Col, FormControl, FormGroup, InputGroup, Row  } from "react-bootstrap";
import { ClipLoader } from "halogenium";

import { listUsers, filterUsers } from "../actions";
import { Button, Icon } from "../../base";
import UsersList from "./List";
import AddUser from "./Add";
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
            this.props.onList();
        }
    }

    render () {

        if (this.props.users === null) {
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

                            <LinkContainer to={{state: {addUser: true}}}>
                                <Button icon="users" tip="Manage Groups" />
                            </LinkContainer>

                            <LinkContainer to={{state: {addUser: true}}}>
                                <Button bsStyle="primary" icon="user-plus" tip="Add User" />
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

                <Route path="/settings/users" render={({ history, location }) => {
                    return (
                        <div>
                            <AddUser
                                show={!!location.state && location.state.addUser}
                                add={this.props.onAdd}
                                onHide={() => history.push({state: {addUser: false}})}
                            />

                            <Groups
                                show={!!location.state && location.state.groups}
                                onHide={() => history.push({state: {groups: false}})}
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
        filter: state.users.filter
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onList: () => {
            dispatch(listUsers());
        },

        onFilter: (term) => {
            dispatch(filterUsers(term));
        },

        onAdd: () => {
            console.log("ADD");
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(ManageUsers);

export default Container;
