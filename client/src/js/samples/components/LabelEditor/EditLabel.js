import React from "react";
import { InputGroup, InputLabel, Input, Button, InputError, Modal, ModalHeader, ModalBody } from "../../../base";
import { ColorSelector } from "./ColorSelector";

const getInitialState = ({ name, color, description, id, errorName, errorColor }) => ({
    name: name || "",
    color: color || "",
    description: description || "",
    id: id || "",
    errorName: errorName || "",
    errorColor: errorColor || ""
});

export class EditLabel extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({
            [name]: value,
            error: ""
        });
    };

    handleColorSelection = e => {
        this.setState(e);
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleSave = () => {
        if (this.state.name === "") {
            this.setState({ errorName: "Please enter a label name" });
        } else if (this.state.color === "") {
            this.setState({ errorColor: "Please select a color" });
        } else {
            this.props.updateLabel({
                id: this.state.id,
                name: this.state.name,
                description: this.state.description,
                color: this.state.color
            });
        }
    };

    render() {
        const { name, description, color, errorName, errorColor } = this.state;
        return (
            <Modal
                label="Create Label"
                show={this.props.show}
                onEnter={this.handleModalEnter}
                onHide={this.props.onHide}
            >
                <ModalHeader>Edit a label</ModalHeader>
                <ModalBody>
                    <form>
                        <InputGroup>
                            <InputLabel>Name</InputLabel>
                            <Input name="name" value={name} onChange={this.handleChange} error={errorName}></Input>
                            <InputError>{errorName}</InputError>
                            <InputLabel>Description</InputLabel>
                            <Input name="description" value={description} onChange={this.handleChange}></Input>
                        </InputGroup>
                        <ColorSelector
                            color={color}
                            onColorChange={this.handleColorSelection}
                            errorColor={errorColor}
                        ></ColorSelector>
                        <Button color="blue" onClick={this.handleSave}>
                            Save
                        </Button>
                    </form>
                </ModalBody>
            </Modal>
        );
    }
}
