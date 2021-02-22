import React from "react";
import { connect } from "react-redux";
import { Modal, ModalHeader } from "../../../../base";
import { clearError } from "../../../../errors/actions";
import { getError } from "../../../../errors/selectors";
import { addSequence, hideOTUModal } from "../../../actions";
import { getTargetName } from "../../../selectors";
import { SequenceForm } from "./Form";

class AddSequence extends React.Component {
    handleSubmit = ({ accession, definition, host, sequence, segment, targetName }) => {
        this.props.onClearError();
        this.props.onSave(
            this.props.otuId,
            this.props.activeIsolateId,
            accession,
            definition,
            host,
            sequence,
            segment,
            targetName
        );
    };

    render() {
        return (
            <Modal label="Add Sequence" show={this.props.show} size="lg" onHide={this.props.onHide}>
                <ModalHeader>Add Sequence</ModalHeader>
                <SequenceForm
                    dataType={this.props.dataType}
                    error={this.props.error}
                    targetName={this.props.targetName}
                    onSubmit={this.handleSubmit}
                />
            </Modal>
        );
    }
}

export const mapStateToProps = state => {
    const { activeIsolateId, sequences, addSequence } = state.otus;

    return {
        activeIsolateId,
        dataType: state.references.detail.data_type,
        sequences,
        error: getError("ADD_SEQUENCE_ERROR"),
        otuId: state.otus.detail.id,
        show: addSequence,
        targetName: getTargetName(state)
    };
};

export const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (otuId, isolateId, accession, definition, host, sequence, segment, target) => {
        dispatch(addSequence(otuId, isolateId, accession, definition, host, sequence, segment, target));
    },

    onClearError: () => {
        dispatch(clearError("ADD_SEQUENCE_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddSequence);
