import React from "react";
import { find, map, filter, differenceWith, isEqual } from "lodash-es";
import { connect } from "react-redux";
import { Badge, ListGroup } from "react-bootstrap";

import AddSequence from "./AddSequence";
import EditSequence from "./EditSequence";
import RemoveSequence from "./RemoveSequence";
import Sequence from "./Sequence";
import { Flex, Icon, NoneFound } from "../../../base";
import { showAddSequence, showEditSequence, showRemoveSequence, getVirus } from "../../actions";
import { formatIsolateName } from "../../../utils";

class IsolateSequences extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            schema: map(this.props.schema, "name")
        };
    }

    componentWillReceiveProps (nextProps) {

        if (this.props.sequences !== nextProps.sequences) {
    //        this.props.getVirus(this.props.virusId);

            const sequencesWithSegment = filter(nextProps.sequences, "segment");
            const segmentsInUse = map(sequencesWithSegment, "segment");
            const remainingSchema = differenceWith(this.state.schema, segmentsInUse, isEqual);
//                console.log(this.state.schema);
//                console.log(segmentsInUse);
//                console.log(remainingSchema);
            this.setState({schema: remainingSchema});
        }
    }

    render () {
        let sequenceComponents;

        if (this.props.sequences.length) {
            sequenceComponents = map(this.props.sequences, sequence =>
                <Sequence
                    key={sequence.id}
                    active={sequence.accession === this.props.activeSequenceId}
                    canModify={this.props.canModify}
                    showEditSequence={this.props.showEditSequence}
                    showRemoveSequence={this.props.showRemoveSequence}
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
                        <Badge>{this.props.sequences.length}</Badge>
                    </span>
                    {this.props.canModify ? (
                        <Icon
                            name="new-entry"
                            bsStyle="primary"
                            tip="Add Sequence"
                            onClick={this.props.showAddSequence}
                            pullRight
                        />
                    ) : null}
                </Flex>

                <ListGroup>
                    {sequenceComponents}
                </ListGroup>

                <AddSequence schema={this.state.schema} />

                <EditSequence
                    virusId={this.props.virusId}
                    isolateId={this.props.activeIsolateId}
                    schema={this.state.schema}
                />

                <RemoveSequence
                    virusId={this.props.virusId}
                    isolateId={this.props.activeIsolateId}
                    isolateName={this.props.isolateName}
                    schema={this.state.schema}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    let sequences = null;
    let activeIsolate = null;

    const activeIsolateId = state.viruses.activeIsolateId;
    const schema = state.viruses.detail.schema;

    if (state.viruses.detail.isolates.length) {
        activeIsolate = find(state.viruses.detail.isolates, {id: activeIsolateId});
        sequences = activeIsolate.sequences;
    }

    return {
        activeIsolateId,
        sequences,
        schema,
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
    },

    getVirus: (virusId) => {
        dispatch(getVirus(virusId));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(IsolateSequences);
