import { filter, includes, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { BoxGroup, BoxGroupSection, DialogBody, Identicon, Input, ModalDialog, NoneFoundSection } from "../../../base";
import { listGroups } from "../../../groups/actions";
import { findUsers } from "../../../users/actions";
import { addReferenceGroup, addReferenceUser } from "../../actions";

const AddUserSearch = ({ term, onChange }) => {
    return <Input type="text" value={term} onChange={onChange} />;
};

const getInitialState = () => ({
    id: "",
    build: false,
    modify: false,
    modify_otu: false,
    remove: false
});

const StyledAddMemberItem = styled(BoxGroupSection)`
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

    handleAdd = id => {
        this.props.onAdd(this.props.refId, id);
    };

    handleEnter = () => {
        this.props.onList();
    };

    handleExited = () => {
        this.props.onChange("");
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
            addMemberComponents = <NoneFoundSection noun={`other ${this.props.noun}s`} />;
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
                    <BoxGroup>{addMemberComponents}</BoxGroup>
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
        term: state.users.term,
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
    },

    onChange: term => {
        dispatch(findUsers(term, 1));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddReferenceMember);
