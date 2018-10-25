import React from "react";
import { includes, map, xor } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";
import { ListGroupItem, Checkbox, NoneFound, LoadingPlaceholder } from "../../base";
import { editUser } from "../actions";
import { listGroups } from "../../groups/actions";

export class UserGroup extends React.Component {
    handleClick = () => {
        this.props.onClick(this.props.id);
    };

    render() {
        return (
            <Col xs={12} md={4}>
                <ListGroupItem className="text-capitalize" onClick={this.handleClick}>
                    {this.props.id}
                    <Checkbox checked={this.props.toggled} pullRight />
                </ListGroupItem>
            </Col>
        );
    }
}

export class UserGroups extends React.Component {
    componentDidMount() {
        this.props.listGroups();
    }

    handleClick = groupId => {
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
                onClick={this.handleClick}
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

const mapStateToProps = state => ({
    documents: state.groups.documents,
    memberGroups: state.users.detail.groups,
    userId: state.users.detail.id
});

const mapDispatchToProps = dispatch => ({
    listGroups: () => {
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
