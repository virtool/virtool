import React from "react";
import { find, map } from "lodash-es";
import { connect } from "react-redux";
import { Badge, ListGroup } from "react-bootstrap";

import AddSequence from "./AddSequence";
import EditSequence from "./EditSequence";
import RemoveSequence from "./RemoveSequence";
import Sequence from "./Sequence";
import { Flex, Icon, NoneFound } from "../../../base";
import { showAddSequence, showEditSequence, showRemoveSequence } from "../../actions";
import { formatIsolateName } from "../../../utils";

const IsolateSequences = (props) => {

    let sequenceComponents;

    if (props.sequences.length) {
        sequenceComponents = map(props.sequences, sequence =>
            <Sequence
                key={sequence.id}
                active={sequence.accession === props.activeSequenceId}
                canModify={props.canModify}
                showEditSequence={props.showEditSequence}
                showRemoveSequence={props.showRemoveSequence}
                {...sequence}
            />
        );
    } else {
        sequenceComponents = <NoneFound noun="sequences" noListGroup />;
    }

    return (
        <div>
            <Flex alignItems="center" style={{marginBottom: "10px"}}>
                <strong style={{flex: "0 1 auto"}}>Sequences</strong>
                <span style={{flex: "1 0 auto", marginLeft: "5px"}}>
                    <Badge>{props.sequences.length}</Badge>
                </span>
                {props.canModify ? (
                    <Icon
                        name="new-entry"
                        bsStyle="primary"
                        tip="Add Sequence"
                        onClick={props.showAddSequence}
                        pullRight
                    />
                ) : null}
            </Flex>

            <ListGroup>
                {sequenceComponents}
            </ListGroup>

            <AddSequence />

            <EditSequence
                virusId={props.virusId}
                isolateId={props.activeIsolateId}
            />

            <RemoveSequence
                virusId={props.virusId}
                isolateId={props.activeIsolateId}
                isolateName={props.isolateName}
            />
        </div>
    );
};

const mapStateToProps = (state) => {
    let sequences = null;
    let activeIsolate = null;

    const activeIsolateId = state.viruses.activeIsolateId;

    if (state.viruses.detail.isolates.length) {
        activeIsolate = find(state.viruses.detail.isolates, {id: activeIsolateId});
        sequences = activeIsolate.sequences;
    }

    return {
        activeIsolateId,
        sequences,
        virusId: state.viruses.detail.id,
        canModify: state.account.permissions.modify_virus,
        editing: state.viruses.editSequence,
        isolateName: formatIsolateName(activeIsolate),
        showAddSequence: state.viruses.showAddSequence,
        showEditSequence: state.viruses.showEditSequence,
        showRemoveSequence: state.viruses.showRemoveSequence
    };
};

const mapDispatchToProps = (dispatch) => ({

    showAddSequence: () => {
        dispatch(showAddSequence());
    },

    showEditSequence: (sequenceId) => {
        dispatch(showEditSequence(sequenceId));
    },

    showRemoveSequence: (sequenceId) => {
        dispatch(showRemoveSequence(sequenceId));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(IsolateSequences);
