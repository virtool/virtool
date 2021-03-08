import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { getRouterLocationStateValue } from "../../app/selectors";
import { Modal, ModalHeader } from "../../base";
import { updateLabel } from "../actions";
import { getLabelById } from "../selectors";
import { LabelForm } from "./Form";

const getInitialState = ({ name, color, description }) => ({
    name: name || "",
    color: color || "",
    description: description || "",
    errorName: "",
    errorColor: ""
});

export class EditLabel extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleChange = (name, value) => {
        this.setState({
            [name]: value,
            error: ""
        });
    };

    handleColorSelection = color => {
        this.setState({ color });
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleSubmit = () => {
        this.props.onSubmit(this.props.id, this.state.name, this.state.description, this.state.color);
    };

    render() {
        const { name, description, color, errorName, errorColor } = this.state;
        return (
            <Modal label="Edit Label" show={this.props.show} onEnter={this.handleModalEnter} onHide={this.props.onHide}>
                <ModalHeader>Edit a label</ModalHeader>
                <LabelForm
                    color={color}
                    description={description}
                    name={name}
                    errorColor={errorColor}
                    errorName={errorName}
                    onChange={this.handleChange}
                    onColorChange={this.handleColorSelection}
                    onSubmit={this.handleSubmit}
                />
            </Modal>
        );
    }
}

export const mapStateToProps = state => {
    const id = getRouterLocationStateValue(state, "editLabel");

    if (id) {
        const { name, color, description } = getLabelById(state, id);
        return {
            id,
            color,
            description,
            name,
            show: true,
            error: get(state, "errors.EDIT_SAMPLE_ERROR.message", "")
        };
    }

    return {
        show: false
    };
};

export const mapDispatchToProps = dispatch => ({
    onSubmit: (id, name, description, color) => {
        dispatch(updateLabel(id, name, description, color));
    },
    onHide: () => {
        dispatch(pushState({ editLabel: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditLabel);
