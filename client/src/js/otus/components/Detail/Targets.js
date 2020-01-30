import React from "react";
import { connect } from "react-redux";
import { get, map, find } from "lodash-es";
import { BoxGroupSection } from "../../../base";
import { checkRefRight, formatIsolateName } from "../../../utils/utils";
import { showAddSequence, showEditSequence, showRemoveSequence } from "../../actions";
import { getActiveIsolate, getSequences } from "../../selectors";
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

    const targetDetail = find(props.targets, { name: props.targetName });
    const addSequence = <AddSequence {...targetDetail} required={required} />;

    return (
        <div>
            <BoxGroupSection>
                <strong>Targets</strong>
            </BoxGroupSection>

            {targetComponents}
            <EditSequence otuId={props.otuId} isolateId={props.activeIsolateId} error={props.error} />

            <RemoveSequence otuId={props.otuId} isolateId={props.activeIsolateId} isolateName={props.isolateName} />
            {addSequence}
        </div>
    );
};

const mapStateToProps = state => {
    const activeIsolateId = state.otus.activeIsolateId;

    const activeIsolate = getActiveIsolate(state);
    const sequences = getSequences(state);

    return {
        activeIsolateId,
        sequences,
        targetName: state.otus.targetName,
        otuId: state.otus.detail.id,
        editing: state.otus.editSequence,
        isolateName: formatIsolateName(activeIsolate),
        canModify: !get(state, "references.detail.remotes_from") && checkRefRight(state, "modify_otu"),
        error: get(state, "errors.EDIT_SEQUENCE_ERROR.message", ""),
        targets: state.references.detail.targets
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
