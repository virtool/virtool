import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";
import { Modal, ModalBody, ModalFooter, ModalHeader, SaveButton } from "../../../base";
import { clearError } from "../../../errors/actions";
import { getError } from "../../../errors/selectors";
import { addSequence } from "../../../otus/actions";
import { getActiveIsolateId, getOTUDetailId } from "../../../otus/selectors";
import { useStateWithReset } from "../../../utils/hooks";
import { useSequenceData } from "../../hooks";
import { getDefaultTargetName } from "../../selectors";
import { SequenceForm } from "../Form";
import TargetsField from "./TargetField";

const AddBarcodeSequence = ({ defaultTarget, error, isolateId, otuId, show, onClearError, onHide, onSave }) => {
    const title = "Add Sequence";

    const { data, updateData } = useSequenceData({});

    const [targetName, setTargetName] = useStateWithReset(defaultTarget);

    const handleSubmit = e => {
        e.preventDefault();

        if (error) {
            onClearError();
        }

        const { accession, definition, host, sequence } = data;

        onSave(otuId, isolateId, accession, definition, host, sequence, targetName);
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

export const mapStateToProps = state => ({
    defaultTarget: getDefaultTargetName(state),
    error: getError(state, "ADD_SEQUENCE_ERROR"),
    isolateId: getActiveIsolateId(state),
    otuId: getOTUDetailId(state)
});

export const mapDispatchToProps = dispatch => ({
    onClearError: () => {
        dispatch(clearError("ADD_SEQUENCE_ERROR"));
    },

    onHide: () => {
        dispatch(pushState({ addSequence: false }));
    },

    onSave: (otuId, isolateId, accession, definition, host, sequence, target) => {
        dispatch(addSequence({ otuId, isolateId, accession, definition, host, sequence, target }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddBarcodeSequence);
