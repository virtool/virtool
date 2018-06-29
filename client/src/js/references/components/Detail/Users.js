import React from "react";
import { connect } from "react-redux";
import { map, filter, some, reduce } from "lodash-es";

import MemberEntry from "./MemberEntry";
import MemberSetting from "./MemberSetting";
import AddReferenceMember from "./AddMember";
import { LoadingPlaceholder, NoneFound } from "../../../base";
import { addReferenceUser, editReferenceUser, removeReferenceUser } from "../../../references/actions";
import { listUsers } from "../../../users/actions";

const getOtherUsers = (userList, users) => {
    const otherUsers = filter(userList, user => (
        !some(users, ["id", user.id])
    ));
    return otherUsers;
};

const getCurrentUsers = (userList, users) => {

    const takenUsers = filter(userList, user => (
        some(users, ["id", user.id])
    ));

    const currentList = users.slice();

    map(takenUsers, (takenUser, index) => (
        reduce(takenUser, (result, value, key) => {
            if (key === "identicon") {
                result[key] = value;
            }
            return result;
        }, currentList[index])
    ));

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

    handleRemove = (userId) => {
        this.props.onRemove(this.props.refId, userId);
    };

    toggleUser = (user) => {
        if (this.state.selectedUser !== user || !this.state.selectedUser) {
            this.setState({ selectedUser: user });
        } else {
            this.setState({ selectedUser: "" });
        }
    };

    handleAdd = (newUser) => {
        this.props.onAdd(this.props.refId, {
            user_id: newUser.id,
            build: newUser.build,
            modify: newUser.modify,
            modify_otu: newUser.modify_otu,
            remove: newUser.remove
        });
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
                <MemberEntry
                    key={user.id}
                    onEdit={this.edit}
                    onRemove={this.handleRemove}
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
            : <NoneFound noun="users" style={{margin: "0"}} />;

        return (
            <div>
                <MemberSetting
                    noun="users"
                    listComponents={listComponents}
                    onAdd={this.add}
                />
                <AddReferenceMember
                    show={this.state.showAdd}
                    list={otherUsers}
                    onAdd={this.handleAdd}
                    onHide={this.handleHide}
                    noun="users"
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    refId: state.references.detail.id,
    users: state.references.detail.users,
    userList: state.users.list
});

const mapDispatchToProps = (dispatch) => ({

    onAdd: (refId, user) => {
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
