import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";
import { map, filter, some, reduce } from "lodash-es";

import UserEntry from "./UserEntry";
import AddReferenceUser from "./AddUser";
import { Flex, FlexItem, Icon, LoadingPlaceholder } from "../../../base";
import { addReferenceUser, editReferenceUser, removeReferenceUser } from "../../../references/actions";
import { listUsers } from "../../../users/actions";

const getOtherUsers = (userList, users) => {
    const otherUsers = filter(userList, user => {
        return !some(users, takenUser => {
            return user.id === takenUser.id;
        });
    });

    return otherUsers;
};

const getCurrentUsers = (userList, users) => {

    const takenUsers = filter(userList, user => {
        return some(users, takenUser => {
            return user.id === takenUser.id;
        });
    });

    const currentList = users.slice();

    map(takenUsers, (takenUser, index) => {
        reduce(takenUser, (result, value, key) => {
            if (key === "identicon") {
                result[key] = value;
            }
            return result;
        }, currentList[index]);
    });

    return currentList;
};

const getInitialState = () => ({
    value: "",
    selectedUser: "",
    showAdd: false
});

class ReferenceUsers extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentDidMount () {
        this.props.onListUsers();
    }

    add = () => {
        this.setState({ showAdd: true });
    };

    edit = (user, key, value) => {
        const update = { [key]: value };
        this.props.onEdit(this.props.refId, user, update);
    };

    remove = (user) => {
        console.log("remove ", user);
    };

    toggleUser = (user) => {
        if (this.state.selectedUser !== user || !this.state.selectedUser) {
            this.setState({ selectedUser: user });
        } else {
            this.setState({ selectedUser: "" });
        }
    };

    handleAdd = (newUser) => {
        this.props.onAdd(this.props.refId, newUser);
        this.setState(getInitialState());
    };

    handleHide = () => {
        this.setState({ showAdd: false });
    };

    render () {

        if (!this.props.userList) {
            return <LoadingPlaceholder />;
        }

        const otherUsers = getOtherUsers(this.props.userList, this.props.users);
        const currentUsers = getCurrentUsers(this.props.userList, this.props.users);

        const listComponents = currentUsers.length
            ? map(currentUsers, user =>
                <UserEntry
                    key={user.id}
                    onEdit={this.edit}
                    onRemove={this.remove}
                    onToggleSelect={this.toggleUser}
                    id={user.id}
                    identicon={user.identicon}
                    permissions={{
                        build: user.build,
                        modify: user.modify,
                        modify_otu: user.modify_otu,
                        remove: user.remove
                    }}
                    isSelected={this.state.selectedUser === user.id}
                />)
            : <div>No members assigned</div>;

        return (
            <div>
                <Row>
                    <Col xs={6} md={6}>
                        <Flex alignItems="center">
                            <FlexItem grow={1} >
                                <h5><strong>Members</strong></h5>
                            </FlexItem>
                            <FlexItem>
                                <Icon
                                    name="plus-square"
                                    bsStyle="primary"
                                    tip="Add Member"
                                    onClick={this.add}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>

                    <Col smHidden md={6} />
                </Row>
                <Row>
                    <Col xs={12} md={6} mdPush={6}>
                        <Panel>
                            <Panel.Body>
                                Edit permissions for, add, or remove individual users that can access this reference.
                            </Panel.Body>
                        </Panel>
                    </Col>
                    <Col xs={12} md={6} mdPull={6}>
                        <Panel>
                            <Panel.Body>
                                {listComponents}
                            </Panel.Body>
                        </Panel>
                    </Col>
                    <Col smHidden md={6} />
                </Row>

                <AddReferenceUser show={this.state.showAdd} userList={otherUsers} onAdd={this.handleAdd} onHide={this.handleHide} />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    refId: state.references.detail.id,
    users: state.references.detail.users,
    groups: state.references.detail.groups,
    userList: state.users.list
});

const mapDispatchToProps = (dispatch) => ({

    onAdd: (refId, user) => {
        console.log("inside onAdd dispatch: ", refId, user);
        dispatch(addReferenceUser(refId, user));
    },

    onEdit: (refId, userId, update) => {
        dispatch(editReferenceUser(refId, userId, update));
    },

    onRemove: (refId, userId) => {
        dispatch(removeReferenceUser(refId, userId));
    },

    onListUsers: () => {
        dispatch(listUsers());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceUsers);
