import React from "react";
import { Modal } from "react-bootstrap";
import { map } from "lodash-es";
import { Button } from "../../../base";

import UserEntry from "./UserEntry";

const getInitialState = () => ({
    selectedUser: "",
    id: "",
    build: false,
    modify: false,
    modify_otu: false,
    remove: false
});

export default class AddReferenceUser extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = (id, key, value) => {
        this.setState({
            id: id,
            [key]: value
        });
    }

    handleSubmit = () => {
        if (!this.state.id.length) {
            return;
        }

        this.props.onAdd({
            user_id: this.state.id,
            build: this.state.build,
            modify: this.state.modify,
            modify_otu: this.state.modify_otu,
            remove: this.state.remove
        });
    }

    handleExited = () => {
        this.props.onHide();
        this.setState(getInitialState());
    }

    toggleUser = (user) => {
        if (this.state.selectedUser !== user || !this.state.selectedUser) {
            this.setState({ ...getInitialState(), selectedUser: user });
        } else {
            this.setState(getInitialState());
        }
    };

    render () {

        const listComponents = this.props.userList.length
            ? map(this.props.userList, user =>
                <UserEntry
                    key={user.id}
                    onEdit={this.handleChange}
                    onToggleSelect={this.toggleUser}
                    add={this.state.selectedUser === user.id}
                    id={user.id}
                    identicon={user.identicon}
                    permissions={this.state.selectedUser === user.id
                        ? {
                            build: this.state.build,
                            modify: this.state.modify,
                            modify_otu: this.state.modify_otu,
                            remove: this.state.remove
                        }
                        : {
                            build: user.build,
                            modify: user.modify,
                            modify_otu: user.modify_otu,
                            remove: user.remove
                        }}
                    isSelected={this.state.selectedUser === user.id}
                />)
            : <div>No users available</div>;

        return (
            <Modal show={this.props.show} onHide={this.handleExited}>
                <Modal.Header closeButton>
                    Add User
                </Modal.Header>
                <Modal.Body style={{height: "300px", overflowY: "auto"}}>
                    {listComponents}
                </Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" onClick={this.handleSubmit} >
                        Add
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
