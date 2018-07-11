import React from "react";
import { connect } from "react-redux";
import { map, filter, some, reduce } from "lodash-es";
import MemberEntry from "./MemberEntry";
import MemberSetting from "./MemberSetting";
import AddReferenceMember from "./AddMember";
import { LoadingPlaceholder, NoneFound } from "../../../base";
import {
    addReferenceUser,
    editReferenceUser,
    removeReferenceUser,
    addReferenceGroup,
    editReferenceGroup,
    removeReferenceGroup
} from "../../../references/actions";
import { listUsers } from "../../../users/actions";
import { listGroups } from "../../../groups/actions";

const getOtherMembers = (list, members) => {
    const otherMembers = filter(list, member => (
        !some(members, ["id", member.id])
    ));
    return otherMembers;
};

const getInitialState = () => ({
    value: "",
    selected: "",
    showAdd: false
});

const getCurrentMembers = (list, members, noun) => {

    if (noun === "groups") {
        return members;
    }

    const takenUsers = filter(list, user => (
        some(members, ["id", user.id])
    ));

    const currentList = members.slice();

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

class ReferenceMembers extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentDidMount () {
        this.props.onList(this.props.noun);
    }

    add = () => {
        this.setState({ showAdd: true });
    };

    edit = (id, key, value) => {
        const update = { [key]: value };
        this.props.onEdit(this.props.refId, id, update, this.props.noun);
    };

    handleRemove = (id) => {
        this.props.onRemove(this.props.refId, id, this.props.noun);
    };

    toggleMember = (member) => {
        if (this.state.selected !== member || !this.state.selected) {
            this.setState({ selected: member });
        } else {
            this.setState({ selected: "" });
        }
    };

    handleAdd = (newMember, idType) => {
        this.props.onAdd(
            this.props.refId,
            {
                [idType]: newMember.id,
                build: newMember.build,
                modify: newMember.modify,
                modify_otu: newMember.modify_otu,
                remove: newMember.remove
            },
            this.props.noun
        );
        this.setState(getInitialState());
    };

    handleHide = () => {
        this.setState({ showAdd: false });
    };

    render () {

        if (!this.props.userList || !this.props.groupList) {
            return <LoadingPlaceholder />;
        }

        const list = (this.props.noun === "users") ? this.props.userList : this.props.groupList;
        const members = (this.props.noun === "users") ? this.props.users : this.props.groups;

        const otherMembers = getOtherMembers(list, members);
        const currentMembers = getCurrentMembers(list, members, this.props.noun);

        const listComponents = currentMembers.length
            ? map(currentMembers, member =>
                <MemberEntry
                    key={member.id}
                    onEdit={this.edit}
                    onRemove={this.handleRemove}
                    onToggleSelect={this.toggleMember}
                    id={member.id}
                    identicon={member.identicon}
                    permissions={{
                        build: member.build,
                        modify: member.modify,
                        modify_otu: member.modify_otu,
                        remove: member.remove
                    }}
                    isSelected={this.state.selected === member.id}
                />)
            : <NoneFound noun={this.props.noun} style={{margin: "0"}} />;

        return (
            <div>
                <MemberSetting
                    noun={this.props.noun}
                    listComponents={listComponents}
                    onAdd={this.add}
                />
                <AddReferenceMember
                    show={this.state.showAdd}
                    list={otherMembers}
                    onAdd={this.handleAdd}
                    onHide={this.handleHide}
                    noun={this.props.noun}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    refId: state.references.detail.id,
    users: state.references.detail.users,
    userList: state.users.list ? state.users.list.documents : null,
    groups: state.references.detail.groups,
    groupList: state.groups.list
});

const mapDispatchToProps = (dispatch) => ({

    onAdd: (refId, member, noun) => {
        if (noun === "users") {
            dispatch(addReferenceUser(refId, member));
        } else {
            dispatch(addReferenceGroup(refId, member));
        }
    },

    onEdit: (refId, id, update, noun) => {
        if (noun === "users") {
            dispatch(editReferenceUser(refId, id, update));
        } else {
            dispatch(editReferenceGroup(refId, id, update));
        }
    },

    onRemove: (refId, id, noun) => {
        if (noun === "users") {
            dispatch(removeReferenceUser(refId, id));
        } else {
            dispatch(removeReferenceGroup(refId, id));
        }
    },

    onList: (noun) => {
        if (noun === "users") {
            dispatch(listUsers(1));
        } else {
            dispatch(listGroups());
        }
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceMembers);
