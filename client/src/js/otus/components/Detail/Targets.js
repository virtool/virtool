import React from "react";
import { connect } from "react-redux";
import { differenceWith, filter, get, isEqual, map, find } from "lodash-es";
import { BoxGroupSection } from "../../../base";
import { checkRefRight, formatIsolateName } from "../../../utils/utils";
import { showAddSequence, showEditSequence, showRemoveSequence } from "../../actions";
import { getActiveIsolate, getTargetName, getSequences } from "../../selectors";
import { Target } from "./Target";
import AddSequence from "./AddSequence";
import Sequence from "./Sequence";
import EditSequence from "./EditSequence";
import RemoveSequence from "./RemoveSequence";

export const IsolateTargets = props => {
    const required = props.target === true ? "REQUIRED" : "NOT REQUIRED";

    let targetComponents;
    if (props.targets) {
        targetComponents = map(props.targets, target => {
            const sequence = find(props.sequences, { target: target.name });
            if (sequence != null) {
                return (
                    <Sequence
                        key={sequence.id}
                        active={sequence.accession === props.activeSequenceId}
                        canModify={props.canModify}
                        showEditSequence={props.showEditSequence}
                        showRemoveSequence={props.showRemoveSequence}
                        targetName={sequence.target}
                        description={target.description}
                        length={target.length}
                        required={required}
                        name={target.name}
                        {...sequence}
                    />
                );
            }
            return (
                <Target
                    key={target.name}
                    name={target.name}
                    required={required}
                    description={target.description}
                    length={target.length}
                    onClick={() => props.showAddSequence(target.name)}
                />
            );
        });
    }

    return (
        <div>
            <BoxGroupSection>
                <strong>Targets</strong>
            </BoxGroupSection>

            {targetComponents}
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

            <AddSequence targetName={props.targetName} />
        </div>
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
        error: get(state, "errors.EDIT_SEQUENCE_ERROR.message", ""),
        targets: state.references.detail.targets,
        schema: state.otus.detail.schema,
        targetName: state.otus.addSequence
    };
};

const mapDispatchToProps = dispatch => ({
    showAddSequence: targetName => {
        dispatch(showAddSequence(targetName));
    },

    showEditSequence: sequenceId => {
        dispatch(showEditSequence(sequenceId));
    },

    showRemoveSequence: sequenceId => {
        dispatch(showRemoveSequence(sequenceId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(IsolateTargets);
