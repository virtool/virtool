import React from "react";
import { InputGroup, InputLabel, Input, Button, SubviewHeaderTitle } from "../../../base";
import { ColorSelector } from "./ColorSelector";

const getInitialState = ({ labelName, color }) => ({
    labelName: labelName || "",
    color: color || ""
});

export class CreateLabel extends React.Component {
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

    handleSubmit = () => {
        this.props.submitNewLabel({ name: this.state.name, color: this.state.color });
    };

    render() {
        const labelName = this.state.labelName;
        const color = this.state.color;
        return (
            <div>
                <form>
                    <InputGroup>
                        <InputLabel>Name</InputLabel>
                        <Input
                            placeholder="Label name"
                            name="labelName"
                            value={labelName}
                            onChange={this.handleChange}
                        ></Input>
                    </InputGroup>
                    <ColorSelector name="color" value={color} onColorChange={this.handleColorSelection}></ColorSelector>
                    <Button color="green" onClick={this.handleSubmit}>
                        Create
                    </Button>
                </form>
            </div>
        );
    }
}
