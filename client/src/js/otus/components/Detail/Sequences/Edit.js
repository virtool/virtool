import { find } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import { Modal, ModalHeader } from "../../../../base";
import { clearError } from "../../../../errors/actions";
import { editSequence, hideOTUModal } from "../../../actions";
import { getSequences, getTargetName } from "../../../selectors";
import { SequenceForm } from "./Form";

const EditSequence = ({
    accession,
    dataType,
    definition,
    host,
    id,
    sequence,
    targetName,
    otuId,
    isolateId,
    onHide
}) => {
    const handleSubmit = useCallback(
        ({ accession, definition, host, sequence, segment, targetName }) =>
            this.props.onSave(
                this.props.otuId,
                this.props.isolateId,
                this.props.id,
                accession,
                definition,
                host,
                sequence,
                segment,
                targetName
            ),
        [otuId, isolateId, id]
    );

    return (
        <Modal label="Edit Sequence" show={!!id} onHide={onHide}>
            <ModalHeader>Edit Sequence</ModalHeader>
            <SequenceForm
                key={`edit_${id}`}
                accession={accession}
                definition={definition}
                host={host}
                sequence={sequence}
                targetName={targetName}
                dataType={dataType}
                onSubmit={handleSubmit}
            />
        </Modal>
    );
};

const mapStateToProps = state => {
    const id = state.otus.editSequence;

    if (id) {
        const sequences = getSequences(state);
        const { accession, definition, host, segment, sequence } = find(sequences, { id });

        return {
            id,
            accession,
            definition,
            host,
            sequence,
            segment,
            targetName: getTargetName(state),
            dataType: state.references.detail.data_type
        };
    }

    return {};
};

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (otuId, isolateId, sequenceId, accession, definition, host, sequence, segment) => {
        dispatch(editSequence(otuId, isolateId, sequenceId, accession, definition, host, sequence, segment));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditSequence);
