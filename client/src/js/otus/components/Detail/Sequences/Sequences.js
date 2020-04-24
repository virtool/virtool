import { differenceWith, filter, get, isEqual, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Badge, BoxGroup, NoneFoundSection } from "../../../../base";
import { checkRefRight, formatIsolateName } from "../../../../utils/utils";
import { showAddSequence, showEditSequence, showRemoveSequence } from "../../../actions";
import { getActiveIsolate, getSequences, getTargetName } from "../../../selectors";
import AddSequence from "./Add";
import EditSequence from "./Edit";
import RemoveSequence from "./Remove";
import Sequence from "./Sequence";

const IsolateSequencesHeader = styled.label`
    align-items: center;
    display: flex;

    strong {
        padding-right: 5px;
    }

    a {
        font-weight: bold;
        margin-left: auto;
    }
`;

export const IsolateSequences = props => {
    let sequenceComponents;

    if (props.sequences.length) {
        sequenceComponents = map(props.sequences, sequence => (
            <Sequence
                key={sequence.id}
                active={sequence.accession === props.activeSequenceId}
                canModify={props.canModify}
                showEditSequence={props.showEditSequence}
                showRemoveSequence={props.showRemoveSequence}
                {...sequence}
            />
        ));
    } else {
        sequenceComponents = <NoneFoundSection noun="sequences" />;
    }

    return (
        <React.Fragment>
            <IsolateSequencesHeader>
                <strong>Sequences</strong>
                <Badge>{props.sequences.length}</Badge>
                {props.canModify ? (
                    <a href="#" onClick={props.showAddSequence}>
                        Add Sequence
                    </a>
                ) : null}
            </IsolateSequencesHeader>

            <BoxGroup>{sequenceComponents}</BoxGroup>

            <AddSequence schema={props.schema} />

            <EditSequence
                otuId={props.otuId}
                isolateId={props.activeIsolateId}
                schema={props.schema}
                error={props.error}
            />

            <RemoveSequence
                otuId={props.otuId}
                isolateId={props.activeIsolateId}
                isolateName={props.isolateName}
                schema={props.schema}
            />
        </React.Fragment>
    );
};

const mapStateToProps = state => {
    const activeIsolateId = state.otus.activeIsolateId;
    const schema = state.otus.detail.schema;

    const activeIsolate = getActiveIsolate(state);
    const sequences = getSequences(state);
    const targetName = getTargetName(state);

    const originalSchema = map(schema, "name");
    const sequencesWithSegment = filter(sequences, "segment");
    const segmentsInUse = map(sequencesWithSegment, "segment");
    const remainingSchema = differenceWith(originalSchema, segmentsInUse, isEqual);

    return {
        remainingSchema,
        activeIsolateId,
        sequences,
        schema,
        targetName,
        otuId: state.otus.detail.id,
        editing: state.otus.editSequence,
        isolateName: formatIsolateName(activeIsolate),
        canModify: !get(state, "references.detail.remotes_from") && checkRefRight(state, "modify_otu"),
        error: get(state, "errors.EDIT_SEQUENCE_ERROR.message", "")
    };
};

const mapDispatchToProps = dispatch => ({
    showAddSequence: () => {
        dispatch(showAddSequence());
    },

    showEditSequence: sequenceId => {
        dispatch(showEditSequence(sequenceId));
    },

    showRemoveSequence: sequenceId => {
        dispatch(showRemoveSequence(sequenceId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(IsolateSequences);
