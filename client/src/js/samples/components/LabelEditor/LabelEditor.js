import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { get, map } from "lodash-es";
import { pushState } from "../../../app/actions";
import { Modal, ModalHeader, ModalBody, ModalFooter, Table } from "../../../base";
import { labelEdit, getLabels, createLabel, removeLabel, updateLabel } from "../../actions";
import { CreateLabel } from "./CreateLabel";
import { LabelItem } from "./LabelItem";
import { EditLabel } from "./EditLabel";

export const LabelTable = styled(Table)`
    border: none;

    thead {
        text-decoration: underline;
    }

    th {
        font-size: ${props => props.theme.fontSize.lg};
    }

    tr {
        border-bottom: none;
    }

    td {
        border: none;
        min-width: 80px;
    }
`;

export const LabelFooter = styled(ModalFooter)`
    text-align: left;
`;

const getInitialState = ({ id, name, description, color, isEdit }) => ({
    id: id || "",
    name: name || "",
    description: description || "",
    color: color || "",
    isEdit: isEdit || false,
    error: ""
});

class LabelEdit extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
        this.props.onLoadLabels();
    };

    handleModalExited = () => {
        if (this.props.error) {
            this.props.onClearError();
        }
    };

    submitNewLabel = e => {
        const { name, description, color } = e;
        this.props.submitNewLabel(name, description, color);
    };

    removeLabel = id => {
        this.props.removeLabel(id);
    };

    updateLabel = e => {
        const { id, name, description, color } = e;
        this.props.updateLabel(id, name, description, color);
        this.setState({
            isEdit: false
        });
        this.props.onLoadLabels();
    };

    editLabel = (id, name, description, color) => {
        this.setState({
            isEdit: true,
            id,
            name,
            description,
            color
        });
    };

    cancelEdit = () => {
        this.setState({
            isEdit: false
        });
    };

    render() {
        const isEdit = this.state.isEdit;
        const labels = map(this.props.labels, label => (
            <LabelItem
                key={label.id}
                name={label.name}
                color={label.color}
                description={label.description}
                id={label.id}
                removeLabel={this.removeLabel}
                editLabel={this.editLabel}
            ></LabelItem>
        ));
        return (
            <Modal
                label="Label Editor"
                show={this.props.show}
                onEnter={this.handleModalEnter}
                onExited={this.handleModalExited}
                onHide={this.props.onHide}
            >
                <ModalHeader>Label Editor</ModalHeader>
                <ModalBody>
                    <LabelTable>
                        <thead>
                            <tr>
                                <th>Labels</th>
                            </tr>
                        </thead>
                        <tbody>{labels}</tbody>
                    </LabelTable>
                </ModalBody>
                <LabelFooter>
                    {isEdit ? (
                        <EditLabel
                            name={this.state.name}
                            description={this.state.description}
                            color={this.state.color}
                            id={this.state.id}
                            updateLabel={this.updateLabel}
                            cancelEdit={this.cancelEdit}
                        ></EditLabel>
                    ) : (
                        <CreateLabel submitNewLabel={this.submitNewLabel}></CreateLabel>
                    )}
                </LabelFooter>
            </Modal>
        );
    }
}

export const mapStateToProps = state => ({
    ...state.samples.detail,
    labels: state.samples.labels,
    show: get(state.router.location.state, "labelEdit", false),
    error: get(state, "errors.UPDATE_SAMPLE_ERROR.message", "")
});

export const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(pushState({ showEdit: false }));
    },

    onEdit: (sampleId, update) => {
        dispatch(labelEdit(sampleId, update));
    },

    onLoadLabels: () => {
        dispatch(getLabels());
    },

    submitNewLabel: (name, description, color) => {
        dispatch(createLabel(name, description, color));
    },

    removeLabel: id => {
        dispatch(removeLabel(id));
    },

    updateLabel: (id, name, description, color) => {
        dispatch(updateLabel(id, name, description, color));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(LabelEdit);
