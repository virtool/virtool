import React from "react";
import styled from "styled-components";
import { filter, includes, map } from "lodash-es";
import { connect } from "react-redux";
import { Identicon, ListGroupItem, NoneFound, ModalDialog, DialogBody } from "../../../base";
import { listGroups } from "../../../groups/actions";
import { findUsers } from "../../../users/actions";
import { addReferenceGroup, addReferenceUser } from "../../actions";
import AddUserSearch from "./AddUserSearch";

const getInitialState = () => ({
    id: "",
    build: false,
    modify: false,
    modify_otu: false,
    remove: false
});

const StyledAddMemberItem = styled(ListGroupItem)`
    display: flex;

    img {
        margin-right: 8px;
    }
`;

const AddMemberItem = ({ id, identicon, onClick }) => (
    <StyledAddMemberItem onClick={onClick}>
        {identicon ? <Identicon size={24} hash={identicon} /> : null}
        {id}
    </StyledAddMemberItem>
);

export class AddReferenceMember extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = (id, key, value) => {
        this.setState({
            id,
            [key]: value
        });
    };

    handleAdd = id => {
        this.props.onAdd(this.props.refId, id);
    };

    handleSubmit = () => {
        if (this.state.id.length) {
            const idType = this.props.noun === "user" ? "user_id" : "group_id";
            this.props.onAdd({ ...this.state }, idType);
        }
    };

    handleEnter = () => {
        this.props.onList();
    };

    handleExited = () => {
        this.props.onHide();
        this.setState(getInitialState());
    };

    render() {
        let addMemberComponents;

        if (this.props.documents.length) {
            addMemberComponents = map(this.props.documents, document => (
                <AddMemberItem key={document.id} {...document} onClick={() => this.handleAdd(document.id)} />
            ));
        } else {
            addMemberComponents = <NoneFound noun={`other ${this.props.noun}s`} noListGroup />;
        }

        const header = "Add ".concat(this.props.noun);
        return (
            <ModalDialog
                label="AddMember"
                headerText={header}
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.handleEnter}
                onExited={this.handleExited}
                capitalize="capitalize"
            >
                <DialogBody>
                    {this.props.noun === "user" ? <AddUserSearch /> : null}
                    {addMemberComponents}
                </DialogBody>
            </ModalDialog>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const noun = ownProps.noun;

    const members = noun === "user" ? state.references.detail.users : state.references.detail.groups;
    const memberIds = map(members, "id");

    const documents = map(noun === "user" ? state.users.documents : state.groups.documents);

    return {
        refId: state.references.detail.id,
        documents: filter(documents, document => !includes(memberIds, document.id))
    };
};

const mapDispatchToProps = (dispatch, ownProps) => ({
    onAdd: (refId, id) => {
        const actionCreator = ownProps.noun === "user" ? addReferenceUser : addReferenceGroup;
        dispatch(actionCreator(refId, id));
    },
    onList: () => {
        if (ownProps.noun === "user") {
            dispatch(findUsers("", 1));
        } else {
            dispatch(listGroups());
        }
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddReferenceMember);
