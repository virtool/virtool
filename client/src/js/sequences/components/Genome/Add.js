import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";
import { Modal, ModalBody, ModalFooter, ModalHeader, SaveButton } from "../../../base";
import { clearError } from "../../../errors/actions";
import { getError } from "../../../errors/selectors";
import { addSequence } from "../../../otus/actions";
import { getActiveIsolateId, getOTUDetailId } from "../../../otus/selectors";
import { useStateWithReset } from "../../../utils/hooks";
import { routerLocationHasState } from "../../../utils/utils";
import { useSequenceData } from "../../hooks";
import { SequenceForm } from "../Form";
import SegmentField from "./SegmentField";

export const AddGenomeSequence = ({ isolateId, otuId, show, onClearError, onHide, onSave }) => {
    const title = "Add Sequence";

    const { data, updateData } = useSequenceData({});

    const [segment, setSegment] = useStateWithReset(undefined);

    const handleSubmit = e => {
        e.preventDefault();
        const { accession, definition, host, sequence } = data;
        onClearError();
        onSave(otuId, isolateId, accession, definition, host, segment, sequence);
    };

    const errors = {};

    return (
        <Modal label={title} show={show} size="lg" onHide={onHide}>
            <ModalHeader>{title}</ModalHeader>
            <form onSubmit={handleSubmit}>
                <ModalBody>
                    <SegmentField value={segment} onChange={name => setSegment(name)} />
                    <SequenceForm {...data} errors={errors} onChange={updateData} />
                </ModalBody>
                <ModalFooter>
                    <SaveButton />
                </ModalFooter>
            </form>
        </Modal>
    );
};

export const mapStateToProps = state => ({
    error: getError(state, "ADD_SEQUENCE_ERROR"),
    isolateId: getActiveIsolateId(state),
    otuId: getOTUDetailId(state),
    show: routerLocationHasState(state, "addSequence")
});

export const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(pushState({ addSequence: false }));
    },

    onClearError: () => {
        dispatch(clearError("ADD_SEQUENCE_ERROR"));
    },

    onSave: (otuId, isolateId, accession, definition, host, segment, sequence) => {
        dispatch(
            addSequence({
                otuId,
                isolateId,
                accession,
                definition,
                host,
                sequence,
                segment
            })
        );
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddGenomeSequence);
