import React from "react";
import { InputGroup, InputLabel, Input, Button, InputError, Modal, ModalHeader, ModalBody } from "../../../base";
import { ColorSelector } from "./ColorSelector";

export class CreateLabel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            labelName: "",
            color: "",
            description: "",
            errorName: "",
            errorColor: ""
        };
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({
            [name]: value,
            error: ""
        });
        if (name === "labelName") {
            this.setState({ errorName: "" });
        }
    };

    handleColorSelection = e => {
        this.setState(e);
        this.setState({ errorColor: "" });
    };

    handleSubmit = () => {
        if (this.state.labelName === "") {
            this.setState({ errorName: "Please enter a label name" });
        } else if (this.state.color === "") {
            this.setState({ errorColor: "Please select a color" });
        } else {
            this.props.submitNewLabel({
                name: this.state.labelName,
                description: this.state.description,
                color: this.state.color
            });
        }
    };

    render() {
        const { labelName, description, color, errorName, errorColor } = this.state;
        return (
            <Modal label="Create Label" show={this.props.show} onHide={this.props.onHide}>
                <ModalHeader>Create a label</ModalHeader>
                <ModalBody>
                    <form>
                        <InputGroup>
                            <InputLabel>Name</InputLabel>
                            <Input
                                name="labelName"
                                value={labelName}
                                onChange={this.handleChange}
                                error={errorName}
                            ></Input>
                            <InputError>{errorName}</InputError>
                            <InputLabel>Description</InputLabel>
                            <Input name="description" value={description} onChange={this.handleChange}></Input>
                        </InputGroup>
                        <ColorSelector
                            color={color}
                            errorColor={errorColor}
                            onColorChange={this.handleColorSelection}
                        ></ColorSelector>
                        <Button color="blue" onClick={this.handleSubmit}>
                            Create
                        </Button>
                    </form>
                </ModalBody>
            </Modal>
        );
    }
}
