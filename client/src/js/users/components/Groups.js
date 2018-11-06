import React from "react";
import { includes, map, xor } from "lodash-es";
import { connect } from "react-redux";
import { Row, Panel } from "react-bootstrap";
import { LoadingPlaceholder, NoneFound } from "../../base";
import { editUser } from "../actions";
import { listGroups } from "../../groups/actions";
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
            <Panel>
                <Panel.Body>
                    <Row>{groupComponents}</Row>
                </Panel.Body>
            </Panel>
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
