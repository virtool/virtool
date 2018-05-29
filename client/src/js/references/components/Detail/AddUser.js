import React from "react";
import { Modal } from "react-bootstrap";
import { Button } from "../../../base";

const getInitialState = () => ({
    newUser: {
        id: "",
        build: false,
        modify: false,
        modify_otu: false,
        remove: false
    }
});

export default class AddReferenceUser extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = (user) => {

        this.setState({
            newUser: {
                id: user.id,
                build: user.build,
                modify: user.modify,
                modify_otu: user.modify_otu,
                remove: user.remove
            }
        });
    }

    handleSubmit = () => {
        this.props.onAdd(this.state.newUser);
    }

    handleExited = () => {
        this.props.onHide();
        this.setState(getInitialState());
    }

    render () {

        return (
            <Modal show={this.props.show} onHide={this.handleExited}>
                <Modal.Header closeButton>
                    Add User
                </Modal.Header>
                <Modal.Body>
                    <div>HERE</div>
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
