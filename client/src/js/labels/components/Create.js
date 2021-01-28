import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Modal, ModalBody, ModalHeader } from "../../base";
import { routerLocationHasState } from "../../utils/utils";
import { pushState } from "../../app/actions";
import { createLabel } from "../actions";
import { LabelForm } from "./Form";

export class Create extends React.Component {
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

    handleColorChange = color => {
        this.setState({ color, errorColor: "" });
    };

    handleSubmit = e => {
        e.preventDefault();

        if (this.state.labelName === "") {
            this.setState({ errorName: "Please enter a label name" });
        } else if (this.state.color === "") {
            this.setState({ errorColor: "Please select a color" });
        } else {
            this.props.onSubmit(this.state.labelName, this.state.description, this.state.color);
            this.props.onHide();
        }
    };

    render() {
        const { labelName, description, color, errorName, errorColor } = this.state;
        return (
            <Modal label="Create Label" show={this.props.show} onHide={this.props.onHide}>
                <ModalHeader>Create a label</ModalHeader>
                <ModalBody>
                    <LabelForm
                        color={color}
                        description={description}
                        name={labelName}
                        errorColor={errorColor}
                        errorName={errorName}
                        onChange={this.handleChange}
                        onColorChange={this.handleColorChange}
                        onSubmit={this.handleSubmit}
                    />
                </ModalBody>
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

export default connect(mapStateToProps, mapDispatchToProps)(Create);
