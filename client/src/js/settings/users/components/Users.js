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

import { Spinner, ListGroupItem, AutoProgressBar } from "virtool/js/components/Base";
import { listUsers, selectUser } from "../../users/actions";
import { listGroups } from "../../groups/actions";
import Password from "./Password";
import PrimaryGroup from "./PrimaryGroup";

/**
 * A component for managing users that is accessible in the options section. Contains components for changing passwords,
 * forcing password resets, changing user roles, and removing and adding users. All of the sessions registered to each
 * user are also shown.
 *
 * @class
 */
class ManageUsers extends React.Component {

    static propTypes = {
        users: React.PropTypes.array,
        activeId: React.PropTypes.string,
        listUsers: React.PropTypes.func,
        onSelectUser: React.PropTypes.func
    };

    componentWillMount () {
        if (this.props.users === null) {
            this.props.listUsers();
        }

        if (this.props.groups === null) {
            this.props.listGroups();
        }
    }

    render () {

        if (this.props.users === null) {
            return <p className="text-center">Loading</p>
        }

        const userComponents = this.props.users.map((user) =>
            <ListGroupItem
                key={user.user_id}
                active={user.user_id === this.props.activeId}
                onClick={() => this.props.onSelectUser(user.user_id)}
            >
                {user.user_id}
            </ListGroupItem>
        );

        let content;

        if (this.props.activeId) {
            content = (
                <Panel header={this.props.activeId}>
                    <AutoProgressBar affixed />
                    <Password />
                    <PrimaryGroup />
                </Panel>
            )
        } else {
            content = (
                <Panel>
                    <div className="text-center">
                        <Spinner color="#777777" />
                    </div>
                </Panel>
            );
        }

        return (
            <Row>
                <Col md={3}>
                    <ListGroup>
                        {userComponents}
                    </ListGroup>
                </Col>
                <Col md={9}>
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
