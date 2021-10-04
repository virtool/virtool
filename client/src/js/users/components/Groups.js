import { includes, map, xor } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import { BoxGroup, LoadingPlaceholder, NoneFoundSection } from "../../base";
import { editUser } from "../actions";
import { UserGroup } from "./Group";

const UserGroupsList = styled(BoxGroup)`
    margin-bottom: 15px;
`;

export class UserGroups extends React.Component {
    handleEdit = groupId => {
        this.props.onEditGroup(this.props.userId, xor(this.props.memberGroups, [groupId]));
    };

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let groupComponents = map(this.props.documents, ({ id }) => (
            <UserGroup key={id} id={id} toggled={includes(this.props.memberGroups, id)} onClick={this.handleEdit} />
        ));

        if (!groupComponents.length) {
            groupComponents = <NoneFoundSection key="noneFound" noun="groups" />;
        }

        return (
            <div>
                <label>Groups</label>
                <UserGroupsList>{groupComponents}</UserGroupsList>
            </div>
        );
    }
}

export const mapStateToProps = state => ({
    documents: state.groups.documents,
    memberGroups: state.users.detail.groups,
    userId: state.users.detail.id
});

export const mapDispatchToProps = dispatch => ({
    onEditGroup: (userId, groups) => {
        dispatch(editUser(userId, { groups }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(UserGroups);
