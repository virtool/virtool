import React from "react";
import { connect } from "react-redux";
import { removeSample } from "../actions";
import { RemoveModal } from "../../base";

const RemoveSample = ({ id, name, show, onHide, onConfirm }) => (
  <RemoveModal
    noun="OTU"
    name={name}
    show={show}
    onConfirm={() => onConfirm(id)}
    onHide={onHide}
  />
);

const mapStateToProps = state => ({
  show: state.samples.showRemove
});

const mapDispatchToProps = dispatch => ({
  onConfirm: sampleId => {
    dispatch(removeSample(sampleId));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RemoveSample);
