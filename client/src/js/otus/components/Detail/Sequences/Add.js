import React from "react";
import { connect } from "react-redux";
import { Box, Modal, ModalBody, ModalHeader } from "../../../../base";
import { clearError } from "../../../../errors/actions";
import { getError } from "../../../../errors/selectors";
import { addSequence, hideOTUModal } from "../../../actions";
import { TargetInfo } from "../Target";
import { SequenceForm } from "./Form";

class AddSequence extends React.Component {
    handleSubmit = ({ accession, definition, host, sequence, segment, target }) => {
        this.props.onClearError();
        this.props.onSave(
            this.props.otuId,
            this.props.activeIsolateId,
            accession,
            definition,
            host,
            sequence,
            segment,
            target
        );
    };

    render() {
        const targetComponent = this.props.targets && (
            <ModalBody>
                <Box>
                    <TargetInfo {...this.props} />
                </Box>
            </ModalBody>
        );

        return (
            <Modal label="Add Sequence" show={this.props.show} onHide={this.props.onHide}>
                <ModalHeader>Add Sequence</ModalHeader>
                {targetComponent}
                <SequenceForm dataType={this.props.dataType} error={this.props.error} onSubmit={this.handleSubmit} />
            </Modal>
        );
    }
}

export const mapStateToProps = state => {
    const { activeIsolateId, sequences, show, targetName } = state.otus;
    const { dataType, targets } = state.references.detail;

    return {
        activeIsolateId,
        dataType,
        sequences,
        show,
        targetName,
        targets,
        error: getError("ADD_SEQUENCE_ERROR"),
        otuId: state.otus.detail.id
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
