import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { get } from "lodash-es";
import { pushState } from "../../../app/actions";
import { Modal, ModalHeader, ModalBody, ModalFooter, Table } from "../../../base";
import { labelEdit, getLabels } from "../../actions";
import { CreateLabel } from "./CreateLabel";
import { LabelItem } from "./LabelItem";

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

const getInitialState = ({ isCreate, isEdit }) => ({
    isCreate: isCreate || false,
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

    handleCreate = () => {
        this.setState({ isCreate: true });
    };

    handleModalExited = () => {
        if (this.props.error) {
            this.props.onClearError();
        }
    };

    submitNewLabel = () => {
        this.props.submitNewLabel();
    }

    render() {
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
                        <tbody>
                            <LabelItem color="blue" name="Testing" description="Hello World"></LabelItem>
                            <LabelItem color="#FFB6C1" name="A really long name" description="This is a test description."></LabelItem>
                        </tbody>
                    </LabelTable>
                </ModalBody>
                <LabelFooter>
                    <CreateLabel></CreateLabel>
                </LabelFooter>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    ...state.samples.detail,
    show: get(state.router.location.state, "labelEdit", false),
    error: get(state, "errors.UPDATE_SAMPLE_ERROR.message", "")
    
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(pushState({ showEdit: false }));
    },

    onEdit: (sampleId, update) => {
        dispatch(labelEdit(sampleId, update));
    },

    onLoadLabels: () => {
        dispatch(getLabels());
    },

    submitNewLabel: () => {
        dispatch(createLabel());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(LabelEdit);
