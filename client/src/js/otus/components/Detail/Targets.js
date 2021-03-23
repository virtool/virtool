import { find, get, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { BoxGroup } from "../../../base";
import { getCanModifyReferenceOTU } from "../../../references/selectors";
import AddSequence from "../../../sequences/components/Add";
import EditSequence from "../../../sequences/components/Edit";
import RemoveSequence from "../../../sequences/components/Remove";
import Sequence from "../../../sequences/components/Sequence";
import { getSequences } from "../../../sequences/selectors";
import { formatIsolateName } from "../../../utils/utils";
import { showAddSequence, showEditSequence, showRemoveSequence } from "../../actions";
import { getActiveIsolate } from "../../selectors";
import { Target } from "./Target";

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
        <React.Fragment>
            <label>Targets</label>
            <BoxGroup>{targetComponents}</BoxGroup>

            <EditSequence otuId={props.otuId} isolateId={props.activeIsolateId} error={props.error} />
            <RemoveSequence otuId={props.otuId} isolateId={props.activeIsolateId} isolateName={props.isolateName} />
            {addSequence}
        </React.Fragment>
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
        canModify: getCanModifyReferenceOTU(state),
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
