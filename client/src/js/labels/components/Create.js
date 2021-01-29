import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { Modal, ModalHeader } from "../../base";
import { routerLocationHasState } from "../../utils/utils";
import { createLabel } from "../actions";
import { LabelForm } from "./Form";

export class CreateLabel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            name: "",
            color: "",
            description: "",
            errorName: "",
            errorColor: ""
        };
    }

    handleChange = (name, value) => {
        this.setState({
            [name]: value,
            errorName: name === "name" ? "" : this.state.errorName
        });
    };

    handleColorChange = color => {
        this.setState({ color, errorColor: "" });
    };

    handleSubmit = () => {
        if (this.state.name === "") {
            this.setState({ errorName: "Please enter a name" });
        } else if (this.state.color === "") {
            this.setState({ errorColor: "Please select a color" });
        } else {
            this.props.onSubmit(this.state.name, this.state.description, this.state.color);
            this.props.onHide();
        }
    };

    render() {
        const { name, description, color, errorName, errorColor } = this.state;
        return (
            <Modal label="Create Label" show={this.props.show} onHide={this.props.onHide}>
                <ModalHeader>Create a label</ModalHeader>
                <LabelForm
                    color={color}
                    description={description}
                    name={name}
                    errorColor={errorColor}
                    errorName={errorName}
                    onChange={this.handleChange}
                    onColorChange={this.handleColorChange}
                    onSubmit={this.handleSubmit}
                />
            </Modal>
        );
    }
}

export const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createLabel"),
    error: get(state, "errors.CREATE_SAMPLE_ERROR.message", "")
});

export const mapDispatchToProps = dispatch => ({
    onSubmit: (name, description, color) => {
        dispatch(createLabel(name, description, color));
    },
    onHide: () => {
        dispatch(pushState({ createLabel: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateLabel);
