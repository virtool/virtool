import React from "react";
import { InputGroup, InputLabel, Input, Button, InputError } from "../../../base";
import { ColorSelector } from "./ColorSelector";

const getInitialState = ({ name, color, description, id, errorName }) => ({
    name: name || "",
    color: color || "",
    description: description || "",
    id: id || "",
    errorName: errorName || ""
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

    handleSave = () => {
        if (this.state.name === "") {
            this.setState({ errorName: "Please enter a label name" });
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
        const name = this.state.name;
        const description = this.state.description;
        const color = this.state.color;
        const errorName = this.errorName;
        return (
            <div>
                <h3>Edit a label</h3>
                <form>
                    <InputGroup>
                        <InputLabel>Name</InputLabel>
                        <Input
                            placeholder="Label name"
                            name="name"
                            value={name}
                            onChange={this.handleChange}
                            error={errorName}
                        ></Input>
                        <InputError>{errorName}</InputError>
                        <InputLabel>Description</InputLabel>
                        <Input
                            placeholder="Description"
                            name="description"
                            value={description}
                            onChange={this.handleChange}
                        ></Input>
                    </InputGroup>
                    <ColorSelector name="color" color={color} onColorChange={this.handleColorSelection}></ColorSelector>
                    <Button color="green" onClick={this.handleSave}>
                        Save
                    </Button>
                    <Button onClick={this.cancelEdit}>Cancel</Button>
                </form>
            </div>
        );
    }
}
