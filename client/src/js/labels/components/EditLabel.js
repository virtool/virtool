import { find, get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Modal, ModalBody, ModalHeader } from "../../base";
import { routerLocationHasState } from "../../utils/utils";
import { pushState } from "../../app/actions";
import { updateLabel } from "../actions";
import { LabelForm } from "./Form";

const getInitialState = ({ labelName, color, description }) => ({
    labelName: labelName || "",
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

    handleChange = e => {
        const { name, value } = e.target;
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

    handleSubmit = e => {
        e.preventDefault();
        if (this.state.labelName === "") {
            this.setState({ errorName: "Please enter a label name" });
        } else if (this.state.color === "") {
            this.setState({ errorColor: "Please select a color" });
        } else {
            this.props.onSubmit(this.props.id, this.state.labelName, this.state.description, this.state.color);
            this.props.onHide();
        }
    };

    render() {
        const { labelName, description, color, errorName, errorColor } = this.state;
        return (
            <Modal label="Edit Label" show={this.props.show} onEnter={this.handleModalEnter} onHide={this.props.onHide}>
                <ModalHeader>Edit a label</ModalHeader>
                <ModalBody>
                    <LabelForm
                        color={color}
                        description={description}
                        name={labelName}
                        errorColor={errorColor}
                        errorName={errorName}
                        onChange={this.handleChange}
                        onColorChange={this.handleColorSelection}
                        onSubmit={this.handleSubmit}
                    />
                </ModalBody>
            </Modal>
        );
    }
}

export const mapStateToProps = (state, ownProps) => {
    const { id } = ownProps;
    const document = find(state.labels.list, { id });
    if (document) {
        const { color, description, name } = document;
        return {
            id,
            color,
            description,
            labelName: name,
            show: routerLocationHasState(state, "editLabel"),
            error: get(state, "errors.EDIT_SAMPLE_ERROR.message", "")
        };
    }

    return {
        show: routerLocationHasState(state, "editLabel")
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
