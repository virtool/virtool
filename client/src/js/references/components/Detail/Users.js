import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";
import { map, filter, some } from "lodash-es";

import UserEntry from "./UserEntry";
import AddReferenceUser from "./AddUser";
import { Flex, FlexItem, Icon } from "../../../base";
import { addReferenceUser, editReferenceUser, removeReferenceUser } from "../../../references/actions";
import { listUsers } from "../../../users/actions";

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

    handleSubmit = (e) => {
        e.preventDefault();

        const newSourceType = "";

        const newSourceTypes = this.props.sourceTypesArray.concat([newSourceType]);
        this.props.onUpdate(newSourceTypes, this.props.isGlobalSettings, this.props.refId);
        this.setState(getInitialState());
    };

    handleHide = () => {
        this.setState({ showAdd: false });
    };

    render () {

        const otherUsers = filter(this.props.userList, user => {
            return !some(this.props.users, takenUser => {
                return user.id === takenUser.id;
            });
        });

        const userIds = map(otherUsers, "id");

        const listComponents = this.props.users.length
            ? map(this.props.users, user =>
                <UserEntry
                    key={user.id}
                    onEdit={this.edit}
                    onRemove={this.remove}
                    onToggleSelect={this.toggleUser}
                    id={user.id}
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

                <AddReferenceUser show={this.state.showAdd} userList={userIds} onAdd={this.add} onHide={this.handleHide} />
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

    onAdd: (refId, users) => {
        dispatch(addReferenceUser(refId, users));
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
