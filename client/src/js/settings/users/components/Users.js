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
import { Row, Col, Panel, ListGroup } from "react-bootstrap";
import { ScaleLoader } from "halogen";

import { ListGroupItem, AutoProgressBar } from "../../../components/Base";
import { listUsers, selectUser } from "../../users/actions";
import { listGroups } from "../../groups/actions";
import Password from "./Password";
import GroupsPermissions from "./GroupsPermissions";
import PrimaryGroup from "./PrimaryGroup";

/**
 * A component for managing users that is accessible in the options section. Contains components for changing passwords,
 * forcing password resets, changing user roles, and removing and adding users. All of the sessions registered to each
 * user are also shown.
 *
 * @class
 */
class ManageUsers extends React.Component {

    constructor (props) {
        super(props);
    }

    componentWillMount () {
        if (this.props.users === null) {
            this.props.listUsers();
        }

        if (this.props.groups === null) {
            this.props.listGroups();
        }
    }

    render () {

        if (this.props.users === null || this.props.groups === null) {
            return (
                <div />
            );
        }

        const userComponents = this.props.users.map((user) =>
            <ListGroupItem
                key={user.id}
                active={user.id === this.props.activeId}
                onClick={() => this.props.onSelectUser(user.id)}
            >
                {user.id}
            </ListGroupItem>
        );

        let content;

        if (this.props.activeId) {
            content = (
                <Panel header={this.props.activeId}>
                    <AutoProgressBar affixed />
                    <Password />
                    <GroupsPermissions />
                    <PrimaryGroup />
                </Panel>
            )
        } else {
            content = (
                <Panel>
                    <div className="text-center" style={{margin: "80px auto"}}>
                        <ScaleLoader color="#3c8786" />
                    </div>
                </Panel>
            );
        }

        return (
            <Row>
                <Col xs={3} md={2}>
                    <ListGroup>
                        {userComponents}
                    </ListGroup>
                </Col>
                <Col xs={9} md={10}>
                    {content}
                </Col>
            </Row>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        users: state.users.list,
        activeId: state.users.activeId,
        groups: state.groups.list
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        listUsers: () => {
            dispatch(listUsers());
        },

        listGroups: () => {
            dispatch(listGroups());
        },

        onSelectUser: (userId) => {
            dispatch(selectUser(userId));
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(ManageUsers);

export default Container;
