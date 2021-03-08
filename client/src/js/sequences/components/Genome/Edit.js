import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";
import { Modal, ModalBody, ModalFooter, ModalHeader, SaveButton } from "../../../base";
import { clearError } from "../../../errors/actions";
import { getError } from "../../../errors/selectors";
import { editSequence } from "../../../otus/actions";
import { getActiveIsolateId, getOTUDetailId } from "../../../otus/selectors";
import { useStateWithReset } from "../../../utils/hooks";
import { routerLocationHasState } from "../../../utils/utils";
import { useSequenceData } from "../../hooks";
import { getActiveSequence } from "../../selectors";
import { SequenceForm } from "../Form";
import SegmentField from "./SegmentField";

export const EditGenomeSequence = ({
    initialAccession,
    initialDefinition,
    initialHost,
    initialSegment,
    initialSequence,
    id,
    isolateId,
    otuId,
    show,
    onClearError,
    onHide,
    onSave
}) => {
    const title = "Edit Sequence";

    const { data, updateData } = useSequenceData({
        accession: initialAccession,
        definition: initialDefinition,
        host: initialHost,
        sequence: initialSequence
    });

    const [segment, setSegment] = useStateWithReset(initialSegment);

    const handleSubmit = e => {
        e.preventDefault();
        const { accession, definition, host, sequence } = data;
        onClearError();
        onSave(otuId, isolateId, id, accession, definition, host, segment, sequence);
    };

    const errors = {};

    return (
        <Modal label={title} show={show} size="lg" onHide={onHide}>
            <ModalHeader>{title}</ModalHeader>
            <form onSubmit={handleSubmit}>
                <ModalBody>
                    <SegmentField value={segment} onChange={setSegment} />
                    <SequenceForm {...data} errors={errors} onChange={updateData} />
                </ModalBody>
                <ModalFooter>
                    <SaveButton />
                </ModalFooter>
            </form>
        </Modal>
    );
};

export const mapStateToProps = state => {
    const { accession, definition, host, id, segment, sequence } = getActiveSequence(state);

    return {
        id,
        initialAccession: accession,
        initialDefinition: definition,
        initialHost: host,
        initialSegment: segment,
        initialSequence: sequence,
        isolateId: getActiveIsolateId(state),
        otuId: getOTUDetailId(state),
        error: getError(state, "EDIT_SEQUENCE_ERROR"),
        show: routerLocationHasState(state, "editSequence")
    };
};

export const mapDispatchToProps = dispatch => ({
    onClearError: () => {
        dispatch(clearError("EDIT_SEQUENCE_ERROR"));
    },

    onHide: () => {
        dispatch(pushState({ addSequence: false, editSequence: false }));
    },

    onSave: (otuId, isolateId, sequenceId, accession, definition, host, segment, sequence) => {
        dispatch(editSequence({ otuId, isolateId, sequenceId, accession, definition, host, sequence, segment }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditGenomeSequence);
