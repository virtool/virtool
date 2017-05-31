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

import { Spinner, ListGroupItem } from "virtool/js/components/Base";
import { listUsers, selectUser } from "../../users/actions";
import Password from "./Password";

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
        activeData: React.PropTypes.object,
        listUsers: React.PropTypes.func,
        onSelectUser: React.PropTypes.func
    };

    componentWillMount () {
        this.props.listUsers();
    }

    render () {

        if (this.props.users === null) {
            return <p className="text-center">Loading</p>
        }

        const userComponents = this.props.users.map((userId) =>
            <ListGroupItem
                key={userId}
                active={userId === this.props.activeId}
                onClick={() => this.props.onSelectUser(userId)}
            >
                {userId}
            </ListGroupItem>
        );

        let content;

        if (this.props.activeData) {
            content = (
                <span>
                    <Password />
                </span>
            )
        } else {
            content = (
                <div className="text-center">
                    <Spinner color="#777777" />
                </div>
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
                    <Panel>
                        {content}
                    </Panel>
                </Col>
            </Row>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        users: state.users.list,
        activeId: state.users.activeId,
        activeData: state.users.activeData
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        listUsers: () => {
            dispatch(listUsers());
        },

        onSelectUser: (userId) => {
            dispatch(selectUser(userId));
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(ManageUsers);

export default Container;
