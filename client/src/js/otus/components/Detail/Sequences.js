import React from "react";
import { find, map, filter, differenceWith, isEqual } from "lodash-es";
import { connect } from "react-redux";
import { Badge, ListGroup } from "react-bootstrap";

import AddSequence from "./AddSequence";
import EditSequence from "./EditSequence";
import RemoveSequence from "./RemoveSequence";
import Sequence from "./Sequence";
import { Flex, Icon, NoneFound } from "../../../base";
import { showAddSequence, showEditSequence, showRemoveSequence } from "../../actions";
import { formatIsolateName } from "../../../utils";

const getInitialState = (props) => {
    const originalSchema = map(props.schema, "name");
    const sequencesWithSegment = filter(props.sequences, "segment");
    const segmentsInUse = map(sequencesWithSegment, "segment");
    const remainingSchema = differenceWith(originalSchema, segmentsInUse, isEqual);

    return {
        schema: remainingSchema
    };
};

class IsolateSequences extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState(this.props);
    }

    componentWillReceiveProps (nextProps) {

        if (this.props.sequences !== nextProps.sequences) {
            this.setState(getInitialState(nextProps));
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
                    OTUId={this.props.OTUId}
                    isolateId={this.props.activeIsolateId}
                    schema={this.state.schema}
                />

                <RemoveSequence
                    OTUId={this.props.OTUId}
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

    const activeIsolateId = state.OTUs.activeIsolateId;
    const schema = state.OTUs.detail.schema;

    if (state.OTUs.detail.isolates.length) {
        activeIsolate = find(state.OTUs.detail.isolates, {id: activeIsolateId});
        sequences = activeIsolate.sequences;
    }

    return {
        activeIsolateId,
        sequences,
        schema,
        OTUId: state.OTUs.detail.id,
        canModify: state.account.permissions.modify_OTU,
        editing: state.OTUs.editSequence,
        isolateName: formatIsolateName(activeIsolate),
        showAddSequence: state.OTUs.showAddSequence,
        showEditSequence: state.OTUs.showEditSequence,
        showRemoveSequence: state.OTUs.showRemoveSequence
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
