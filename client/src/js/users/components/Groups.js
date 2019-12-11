import { includes, map, xor } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Box } from "../../base/Box";

import { LoadingPlaceholder, NoneFound } from "../../base";
import { listGroups } from "../../groups/actions";
import { editUser } from "../actions";
import { UserGroup } from "./Group";

export class UserGroups extends React.Component {
    componentDidMount() {
        this.props.onList();
    }

    handleEdit = groupId => {
        this.props.onEditGroup(this.props.userId, xor(this.props.memberGroups, [groupId]));
    };

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        if (!this.props.documents) {
            return <NoneFound noun="groups" />;
        }

        const groupComponents = map(this.props.documents, document => (
            <UserGroup
                key={document.id}
                id={document.id}
                toggled={includes(this.props.memberGroups, document.id)}
                onClick={this.handleEdit}
            />
        ));

        return (
            <div>
                <label>Groups</label>
                <Box>{groupComponents}</Box>
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
    onList: () => {
        dispatch(listGroups());
    },
    onEditGroup: (userId, groups) => {
        dispatch(editUser(userId, { groups }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(UserGroups);
