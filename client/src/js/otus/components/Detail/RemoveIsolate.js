import React from "react";
import { connect } from "react-redux";
import { removeIsolate, hideOTUModal } from "../../actions";
import { RemoveModal } from "../../../base";

export class RemoveIsolate extends React.Component {
  handleConfirm = () => {
    this.props.onConfirm(
      this.props.otuId,
      this.props.isolateId,
      this.props.nextIsolateId
    );
  };

  render() {
    return (
      <RemoveModal
        name={this.props.isolateName}
        noun="Isolate"
        onConfirm={this.handleConfirm}
        onHide={this.props.onHide}
        show={this.props.show}
      />
    );
  }
}

const mapStateToProps = state => ({
  show: state.otus.removeIsolate
});

const mapDispatchToProps = dispatch => ({
  onHide: () => {
    dispatch(hideOTUModal());
  },

  onConfirm: (otuId, isolateId, nextIsolateId) => {
    dispatch(removeIsolate(otuId, isolateId, nextIsolateId));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RemoveIsolate);
