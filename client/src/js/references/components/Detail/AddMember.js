import React from "react";
import { connect } from "react-redux";
import { ListGroup, Modal } from "react-bootstrap";
import { filter, includes, map } from "lodash-es";
import { Identicon, ListGroupItem, NoneFound } from "../../../base";
import { listGroups } from "../../../groups/actions";
import { findUsers } from "../../../users/actions";
import { addReferenceGroup, addReferenceUser } from "../../actions";

const getInitialState = () => ({
    id: "",
    build: false,
    modify: false,
    modify_otu: false,
    remove: false
});

const AddMemberItem = ({ id, identicon, onClick }) => (
    <ListGroupItem onClick={onClick}>
        {identicon ? <Identicon size={24} hash={identicon} /> : null}
        {id}
    </ListGroupItem>
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
            const idType = this.props.noun === "users" ? "user_id" : "group_id";
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
            addMemberComponents = <NoneFound noun={this.props.noun} />;
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.handleEnter}
                onExited={this.handleExited}
            >
                <Modal.Header closeButton>
                    <span className="text-capitalize">Add {this.props.noun}</span>
                </Modal.Header>
                <ListGroup>{addMemberComponents}</ListGroup>
            </Modal>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const noun = ownProps.noun;

    const members = noun === "users" ? state.references.detail.users : state.references.detail.groups;
    const memberIds = map(members, "id");

    const documents = map(noun === "users" ? state.users.documents : state.groups.documents);

    return {
        refId: state.references.detail.id,
        documents: filter(documents, document => !includes(memberIds, document.id))
    };
};

const mapDispatchToProps = (dispatch, ownProps) => ({
    onAdd: (refId, id) => {
        const actionCreator = ownProps.noun === "users" ? addReferenceUser : addReferenceGroup;
        dispatch(actionCreator(refId, id));
    },
    onList: () => {
        if (ownProps.noun === "users") {
            dispatch(findUsers("", 1));
        } else {
            dispatch(listGroups());
        }
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AddReferenceMember);
