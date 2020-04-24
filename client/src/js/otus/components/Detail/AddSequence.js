import React from "react";
import { connect } from "react-redux";
import { Box, ModalBody, Modal, ModalHeader } from "../../../base";
import { clearError } from "../../../errors/actions";
import { getError } from "../../../errors/selectors";
import { addSequence, hideOTUModal } from "../../actions";
import { SequenceForm } from "./SequenceForm";
import { TargetInfo } from "./Target";

class AddSequence extends React.Component {
    handleSubmit = ({ accession, definition, host, sequence, segment, target }) => {
        this.props.onClearError();
        this.props.onSave(
            this.props.otuId,
            this.props.isolateId,
            accession,
            definition,
            host,
            sequence,
            segment,
            target
        );
    };

    render() {
        const targetComponent = this.props.targets ? (
            <ModalBody>
                <Box>
                    <TargetInfo {...this.props} />
                </Box>
            </ModalBody>
        ) : null;

        return (
            <Modal label="Add Sequence" show={this.props.show} onHide={this.props.onHide}>
                <ModalHeader>Add Sequence</ModalHeader>
                {targetComponent}
                <SequenceForm dataType={this.props.dataType} error={this.props.error} onSubmit={this.handleSubmit} />
            </Modal>
        );
    }
}

const mapStateToProps = state => {
    return {
        sequences: state.otus.activeIsolate.sequences,
        show: state.otus.addSequence,
        targetName: state.otus.targetName,
        otuId: state.otus.detail.id,
        isolateId: state.otus.activeIsolateId,
        error: getError("ADD_SEQUENCE_ERROR"),
        dataType: state.references.detail.data_type,
        targets: state.references.detail.targets
    };
};

const mapDispatchToProps = dispatch => ({
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
