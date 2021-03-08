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
import TargetsField from "./TargetField";

const EditBarcodeSequence = ({
    error,
    id,
    initialAccession,
    initialDefinition,
    initialHost,
    initialSequence,
    initialTarget,
    isolateId,
    otuId,
    show,
    onClearError,
    onHide,
    onSave
}) => {
    const { data, updateData } = useSequenceData({
        accession: initialAccession,
        definition: initialDefinition,
        host: initialHost,
        sequence: initialSequence
    });

    const title = "Edit Sequence";

    const [targetName, setTargetName] = useStateWithReset(initialTarget);

    const handleSubmit = e => {
        e.preventDefault();

        if (error) {
            onClearError();
        }

        const { accession, definition, host, sequence } = data;

        onSave(otuId, isolateId, id, accession, definition, host, sequence, targetName);
    };

    const errors = {};

    return (
        <Modal label={title} show={show} size="lg" onHide={onHide}>
            <ModalHeader>{title}</ModalHeader>
            {show && (
                <form onSubmit={handleSubmit}>
                    <ModalBody>
                        <TargetsField value={targetName} onChange={setTargetName} />
                        <SequenceForm {...data} errors={errors} onChange={updateData} />
                    </ModalBody>
                    <ModalFooter>
                        <SaveButton />
                    </ModalFooter>
                </form>
            )}
        </Modal>
    );
};

export const mapStateToProps = state => {
    const { accession, definition, host, id, sequence, target } = getActiveSequence(state);

    return {
        error: getError("EDIT_SEQUENCE_ERROR"),
        id,
        initialAccession: accession,
        initialDefinition: definition,
        initialHost: host,
        initialSequence: sequence,
        initialTarget: target,
        isolateId: getActiveIsolateId(state),
        otuId: getOTUDetailId(state),
        show: routerLocationHasState(state, "editSequence")
    };
};

export const mapDispatchToProps = dispatch => ({
    onSave: (otuId, isolateId, accession, definition, host, sequence, target) => {
        dispatch(editSequence(otuId, isolateId, sequenceId, { accession, definition, host, sequence, target }));
    },

    onHide: () => {
        dispatch(pushState({ editSequence: false }));
    },

    onClearError: () => {
        dispatch(clearError("EDIT_SEQUENCE_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditBarcodeSequence);
