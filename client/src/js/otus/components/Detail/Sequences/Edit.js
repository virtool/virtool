import { find } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Modal, ModalHeader } from "../../../../base";
import { clearError } from "../../../../errors/actions";
import { editSequence, hideOTUModal } from "../../../actions";
import { getSequences } from "../../../selectors";
import { SequenceForm } from "./Form";

class EditSequence extends React.Component {
    handleSubmit = ({ accession, definition, host, sequence, segment, targetName }) => {
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
        );
    };

    render() {
        const { accession, dataType, definition, host, id, sequence } = this.props;

        return (
            <Modal label="Edit Sequence" show={!!id} onHide={this.props.onHide}>
                <ModalHeader>Edit Sequence</ModalHeader>
                <SequenceForm
                    key={`edit_${id}`}
                    accession={accession}
                    definition={definition}
                    host={host}
                    sequence={sequence}
                    dataType={dataType}
                    onSubmit={this.handleSubmit}
                />
            </Modal>
        );
    }
}

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
            dataType: state.references.detail.dataType
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
