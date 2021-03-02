import { map, sortBy } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, BoxGroupSection, Icon } from "../../../base";
import {
    addReferenceGroup,
    addReferenceUser,
    editReferenceGroup,
    editReferenceUser,
    removeReferenceGroup,
    removeReferenceUser
} from "../../actions";
import { checkReferenceRight } from "../../selectors";
import AddReferenceMember from "./AddMember";
import EditReferenceMember from "./EditMember";
import MemberItem from "./MemberItem";

const getInitialState = () => ({
    showAdd: false,
    showEdit: false
});

const NewMemberLink = styled.a`
    cursor: pointer;
    margin-left: auto;
`;

const NoMembers = styled(BoxGroupSection)`
    align-items: center;
    justify-content: center;
    display: flex;

    i {
        padding-right: 3px;
    }
`;

const ReferenceMembersHeader = styled(BoxGroupHeader)`
    padding-bottom: 10px;

    h2 {
        text-transform: capitalize;
    }
`;

class ReferenceMembers extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        canModify: PropTypes.bool.isRequired,
        members: PropTypes.arrayOf(PropTypes.object).isRequired,
        noun: PropTypes.oneOf(["group", "user"]).isRequired,
        onAdd: PropTypes.func.isRequired,
        onEdit: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
        refId: PropTypes.string.isRequired
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
        const { canModify, members, noun } = this.props;

        const plural = `${noun}s`;

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
            memberComponents = (
                <NoMembers>
                    <Icon name="exclamation-circle" /> None Found
                </NoMembers>
            );
        }

        let addButton;

        if (this.props.canModify) {
            addButton = <NewMemberLink onClick={this.add}>Add {noun}</NewMemberLink>;
        }

        return (
            <React.Fragment>
                <BoxGroup>
                    <ReferenceMembersHeader>
                        <h2>
                            {plural}
                            {addButton}
                        </h2>
                        <p>Manage membership and rights for reference {plural}.</p>
                    </ReferenceMembersHeader>
                    {memberComponents}
                </BoxGroup>
                <AddReferenceMember show={this.state.showAdd} noun={noun} onHide={this.handleHide} />
                <EditReferenceMember show={this.state.showEdit} noun={noun} onHide={this.handleHide} />
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const noun = ownProps.noun;

    return {
        refId: state.references.detail.id,
        members: sortBy(noun === "user" ? state.references.detail.users : state.references.detail.groups, "id"),
        canModify: checkReferenceRight(state, "modify")
    };
};

const mapDispatchToProps = (dispatch, ownProps) => ({
    onAdd: (refId, member) => {
        const actionCreator = ownProps.noun === "user" ? addReferenceUser : addReferenceGroup;
        dispatch(actionCreator(refId, member));
    },

    onEdit: (refId, id, update) => {
        const actionCreator = ownProps.noun === "user" ? editReferenceUser : editReferenceGroup;
        dispatch(actionCreator(refId, id, update));
    },

    onRemove: (refId, id) => {
        const actionCreator = ownProps.noun === "user" ? removeReferenceUser : removeReferenceGroup;
        dispatch(actionCreator(refId, id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceMembers);
