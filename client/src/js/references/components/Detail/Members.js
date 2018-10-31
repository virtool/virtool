import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { ListGroup, ListGroupItem, Panel } from "react-bootstrap";
import { map, sortBy } from "lodash-es";
import { Button, LoadingPlaceholder, NoneFound } from "../../../base";
import {
    addReferenceUser,
    editReferenceUser,
    removeReferenceUser,
    addReferenceGroup,
    editReferenceGroup,
    removeReferenceGroup
} from "../../../references/actions";
import { checkRefRight } from "../../../utils";
import AddReferenceMember from "./AddMember";
import EditReferenceMember from "./EditMember";
import MemberItem from "./MemberItem";

const getInitialState = () => ({
    showAdd: false,
    showEdit: false
});

class ReferenceMembers extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        noun: PropTypes.oneOf(["groups", "users"]).isRequired
    };

    add = () => {
        this.setState({ showAdd: true });
    };

    edit = id => {
        this.setState({ showEdit: id });
    };

    handleHide = () => {
        this.setState({ showAdd: false, showEdit: false });
    };

    handleRemove = id => {
        this.props.onRemove(this.props.refId, id);
    };

    render() {
        const { canModify, list, members, noun } = this.props;

        if (list === null) {
            return <LoadingPlaceholder />;
        }

        let memberComponents;

        if (members.length) {
            memberComponents = map(members, member => (
                <MemberItem
                    key={member.id}
                    {...member}
                    canModify={canModify}
                    onEdit={this.edit}
                    onRemove={this.handleRemove}
                />
            ));
        } else {
            memberComponents = <NoneFound noun={noun} style={{ margin: 0 }} noListGroup />;
        }

        let addButton;

        if (this.props.canModify) {
            addButton = (
                <Button bsSize="xsmall" bsStyle="primary" icon="plus-square" onClick={this.add} pullRight>
                    Add
                </Button>
            );
        }

        return (
            <Panel>
                <ListGroup>
                    <ListGroupItem key="heading">
                        <strong className="text-capitalize">{noun}</strong>
                        {addButton}
                    </ListGroupItem>
                    <ListGroupItem>Manage membership and rights for reference {noun}.</ListGroupItem>
                    {memberComponents}
                </ListGroup>
                <AddReferenceMember show={this.state.showAdd} noun={noun} onHide={this.handleHide} />
                <EditReferenceMember show={this.state.showEdit} noun={noun} onHide={this.handleHide} />
            </Panel>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const noun = ownProps.noun;

    return {
        refId: state.references.detail.id,
        members: sortBy(noun === "users" ? state.references.detail.users : state.references.detail.groups, "id"),
        documents: noun === "users" ? state.users.documents : state.groups.documents,
        canModify: checkRefRight(state, "modify")
    };
};

const mapDispatchToProps = (dispatch, ownProps) => ({
    onAdd: (refId, member) => {
        const actionCreator = ownProps.noun === "users" ? addReferenceUser : addReferenceGroup;
        dispatch(actionCreator(refId, member));
    },

    onEdit: (refId, id, update) => {
        const actionCreator = ownProps.noun === "users" ? editReferenceUser : editReferenceGroup;
        dispatch(actionCreator(refId, id, update));
    },

    onRemove: (refId, id) => {
        const actionCreator = ownProps.noun === "users" ? removeReferenceUser : removeReferenceGroup;
        dispatch(actionCreator(refId, id));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ReferenceMembers);
