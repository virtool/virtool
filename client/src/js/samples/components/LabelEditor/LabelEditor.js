import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { get, map } from "lodash-es";
import { Table, ViewHeader, ViewHeaderTitle, RemoveModal, Button, BoxGroup, BoxGroupHeader, Flex } from "../../../base";
import { getLabels, createLabel, removeLabel, updateLabel } from "../../actions";
import { CreateLabel } from "./CreateLabel";
import { LabelItem } from "./LabelItem";
import { EditLabel } from "./EditLabel";

export const StyledTable = styled(Table)`
    border: none;

    thead {
        text-decoration: underline;
    }

    th {
        font-size: ${props => props.theme.fontSize.lg};
        border: none;
    }

    tr {
        border-bottom: none;
    }

    td {
        border: none;
        min-width: 80px;
    }
`;

export const StyledButton = styled(Button)`
    margin-left: auto;
`;

const getInitialState = ({ id, name, description, color, isEdit, isRemove, isCreate }) => ({
    id: id || "",
    name: name || "",
    description: description || "",
    color: color || "",
    isEdit: isEdit || false,
    isRemove: isRemove || false,
    isCreate: isCreate || false,
    error: ""
});

class LabelEdit extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    componentDidMount = () => {
        this.setState(getInitialState(this.props));
        this.props.onLoadLabels();
    };

    submitNewLabel = e => {
        const { name, description, color } = e;
        this.props.submitNewLabel(name, description, color);
        this.setState({
            isCreate: false
        });
    };

    updateLabel = e => {
        const { id, name, description, color } = e;
        this.props.updateLabel(id, name, description, color);
        this.setState({
            isEdit: false
        });
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

    removeLabel = () => {
        this.props.removeLabel(this.state.id);
        this.setState({
            isRemove: false
        });
    };

    onCreate = () => {
        this.setState({
            isCreate: true
        });
    };

    onRemove = (id, name) => {
        this.setState({
            isRemove: true,
            id,
            name
        });
    };

    cancelModal = modalType => {
        this.setState({
            [modalType]: false
        });
    };

    render() {
        const labels = map(this.props.labels, label => (
            <LabelItem
                key={label.id}
                name={label.name}
                color={label.color}
                description={label.description}
                id={label.id}
                removeLabel={this.onRemove}
                editLabel={this.editLabel}
            ></LabelItem>
        ));
        return (
            <div>
                <ViewHeader title="Label Editor">
                    <ViewHeaderTitle>Label Editor</ViewHeaderTitle>
                </ViewHeader>
                <BoxGroup>
                    <BoxGroupHeader>
                        <Flex>
                            <h2>Labels</h2>
                            <StyledButton color="green" icon="fas fa-plus" onClick={() => this.onCreate()}>
                                New Label
                            </StyledButton>
                        </Flex>
                    </BoxGroupHeader>
                    <StyledTable>
                        <tbody>{labels}</tbody>
                    </StyledTable>
                </BoxGroup>
                <CreateLabel
                    show={this.state.isCreate}
                    onHide={() => this.cancelModal("isCreate")}
                    submitNewLabel={this.submitNewLabel}
                ></CreateLabel>
                <EditLabel
                    id={this.state.id}
                    name={this.state.name}
                    description={this.state.description}
                    color={this.state.color}
                    show={this.state.isEdit}
                    onHide={() => this.cancelModal("isEdit")}
                    updateLabel={this.updateLabel}
                ></EditLabel>
                <RemoveModal
                    noun="Label"
                    name={this.state.name}
                    show={this.state.isRemove}
                    onConfirm={this.removeLabel}
                    onHide={() => this.cancelModal("isRemove")}
                ></RemoveModal>
            </div>
        );
    }
}

export const mapStateToProps = state => ({
    ...state.samples.detail,
    labels: state.samples.labels,
    error: get(state, "errors.UPDATE_SAMPLE_ERROR.message", "")
});

export const mapDispatchToProps = dispatch => ({
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
