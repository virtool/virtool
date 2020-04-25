import React from "react";
import { connect } from "react-redux";
import { ModalBody, ModalFooter, Input, InputGroup, InputLabel, Modal, SaveButton, ModalHeader } from "../../base";
import { editSubtraction } from "../actions";

export class EditSubtraction extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            error: "",
            name: props.name,
            nickname: props.nickname
        };
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({
            [name]: value
        });
    };

    handleSubmit = e => {
        e.preventDefault();

        if (this.state.name === "") {
            return setState({
                error: "A name must be provided"
            });
        }

        this.props.onUpdate(this.props.id, this.state.name, this.state.nickname);
        this.props.onHide();
    };

    render() {
        return (
            <Modal label="Edit Subtraction" show={this.props.show} onHide={this.props.onHide}>
                <ModalHeader>Edit Subtraction</ModalHeader>
                <form onSubmit={this.handleSubmit}>
                    <ModalBody>
                        <InputGroup>
                            <InputLabel>Name</InputLabel>
                            <Input name="name" value={this.state.name} onChange={this.handleChange} />
                        </InputGroup>
                        <InputGroup>
                            <InputLabel>Nickname</InputLabel>
                            <Input name="nickname" value={this.state.nickname} onChange={this.handleChange} />
                        </InputGroup>
                    </ModalBody>

                    <ModalFooter>
                        <SaveButton />
                    </ModalFooter>
                </form>
            </Modal>
        );
    }
}

export const mapStateToProps = state => {
    const { id, name, nickname } = state.subtraction.detail;
    return { id, name, nickname };
};

export const mapDispatchToProps = dispatch => ({
    onUpdate: (id, name, nickname) => {
        dispatch(editSubtraction(id, name, nickname));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditSubtraction);
