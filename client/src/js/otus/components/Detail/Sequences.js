import React from "react";
import {
  find,
  map,
  filter,
  differenceWith,
  isEqual,
  get,
  sortBy,
  indexOf
} from "lodash-es";
import { connect } from "react-redux";
import { Badge, ListGroup } from "react-bootstrap";

import { Flex, Icon, NoneFound } from "../../../base";
import {
  showAddSequence,
  showEditSequence,
  showRemoveSequence
} from "../../actions";
import { formatIsolateName } from "../../../utils";
import AddSequence from "./AddSequence";
import EditSequence from "./EditSequence";
import RemoveSequence from "./RemoveSequence";
import Sequence from "./Sequence";

const getInitialState = props => {
  const originalSchema = map(props.schema, "name");
  const sequencesWithSegment = filter(props.sequences, "segment");
  const segmentsInUse = map(sequencesWithSegment, "segment");
  const remainingSchema = differenceWith(
    originalSchema,
    segmentsInUse,
    isEqual
  );

  let index;

  const sortedSequences = sortBy(props.sequences, [
    entry => {
      index = indexOf(originalSchema, entry.segment);
      if (index !== -1) {
        return index;
      }
      return originalSchema.length;
    }
  ]);

  return {
    schema: remainingSchema,
    sequences: sortedSequences,
    error: props.error
  };
};

class IsolateSequences extends React.Component {
  constructor(props) {
    super(props);
    this.state = getInitialState(this.props);
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (
      prevState.sequences !== nextProps.sequences ||
      (!prevState.error && nextProps.error)
    ) {
      return getInitialState(nextProps);
    }
    if (prevState.error && !nextProps.error) {
      return { error: "" };
    }
    return null;
  }

  render() {
    let sequenceComponents;

    if (this.state.sequences.length) {
      sequenceComponents = map(this.state.sequences, sequence => (
        <Sequence
          key={sequence.id}
          active={sequence.accession === this.props.activeSequenceId}
          canModify={this.props.hasModifyOTU && !this.props.isRemote}
          showEditSequence={this.props.showEditSequence}
          showRemoveSequence={this.props.showRemoveSequence}
          {...sequence}
        />
      ));
    } else {
      sequenceComponents = <NoneFound noun="sequences" noListGroup />;
    }

    return (
      <div>
        <Flex alignItems="center" style={{ marginBottom: "10px" }}>
          <strong style={{ flex: "0 1 auto" }}>Sequences</strong>
          <span style={{ flex: "1 0 auto", marginLeft: "5px" }}>
            <Badge>{this.props.sequences.length}</Badge>
          </span>
          {this.props.hasModifyOTU && !this.props.isRemote ? (
            <Icon
              name="plus-square"
              bsStyle="primary"
              tip="Add Sequence"
              tipPlacement="left"
              onClick={this.props.showAddSequence}
              pullRight
            />
          ) : null}
        </Flex>

        <ListGroup>{sequenceComponents}</ListGroup>

        <AddSequence schema={this.state.schema} />

        <EditSequence
          otuId={this.props.otuId}
          isolateId={this.props.activeIsolateId}
          schema={this.state.schema}
          error={this.props.error}
        />

        <RemoveSequence
          otuId={this.props.otuId}
          isolateId={this.props.activeIsolateId}
          isolateName={this.props.isolateName}
          schema={this.state.schema}
        />
      </div>
    );
  }
}

const mapStateToProps = state => {
  let sequences = null;
  let activeIsolate = null;

  const activeIsolateId = state.otus.activeIsolateId;
  const schema = state.otus.detail.schema;

  if (state.otus.detail.isolates.length) {
    activeIsolate = find(state.otus.detail.isolates, { id: activeIsolateId });
    sequences = activeIsolate.sequences;
  }

  return {
    activeIsolateId,
    sequences,
    schema,
    otuId: state.otus.detail.id,
    editing: state.otus.editSequence,
    isolateName: formatIsolateName(activeIsolate),
    isRemote: state.references.detail.remotes_from,
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

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(IsolateSequences);
